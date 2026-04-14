import { fork, type ChildProcess } from 'child_process'
import axios from 'axios'
import mysql from 'mysql2/promise'
import type { TenantService } from './TenantService.js'
import type { SubscriptionService } from './SubscriptionService.js'
import type { LogService } from './LogService.js'

export interface InstanceInfo {
  tenantId: string
  process: ChildProcess
  status: 'starting' | 'running' | 'stopping' | 'error'
  lastHeartbeat: number
  restartCount: number
}

export interface InstanceConfig {
  tenantId: string
  botToken: string
  enabledPlugins: string[]
  pluginConfigs: Record<string, Record<string, any>>
  mysqlUrl: string
  redisUrl: string
}

export interface InstanceDiagnosis {
  tenantId: string
  tracked: boolean
  status: 'running' | 'starting' | 'stopping' | 'error' | 'stopped'
  pid: number | null
  lastHeartbeat: number | null
  missingTables: string[]
  checks: {
    tenantTablesOk: boolean
    processTracked: boolean
  }
}

export class InstanceManager {
  private instances = new Map<string, InstanceInfo>()
  private readonly requiredTenantTables = [
    'plugin_points_checkin_records',
    'plugin_points_user_points',
    'plugin_filter_ads',
  ]

  constructor(
    private tenantService: TenantService,
    private subscriptionService: SubscriptionService,
    private config: {
      mysqlUrl: string
      redisUrl: string
      engineEntryPath: string
    },
    private logService?: LogService,
  ) {}

  private async runPreflightChecks(
    botToken: string,
    pluginConfigs: Record<string, Record<string, any>>,
  ): Promise<void> {
    await Promise.all([
      this.validateBotToken(botToken),
      this.validatePluginConfigShape(pluginConfigs),
      this.verifyTenantTables(),
    ])
  }

  private async validateBotToken(botToken: string): Promise<void> {
    try {
      const resp = await axios.get('https://www.kookapp.cn/api/v3/gateway/index', {
        params: { compress: 0 },
        headers: { Authorization: `Bot ${botToken}` },
        timeout: 8000,
      })
      if (resp.data?.code !== 0 || !resp.data?.data?.url) {
        throw new Error(resp.data?.message || 'Kook 网关返回异常')
      }
    } catch (err: any) {
      const status = err?.response?.status
      const message = err?.response?.data?.message || err?.message || String(err)
      throw new Error(`Bot Token 校验失败${status ? ` (HTTP ${status})` : ''}: ${message}`)
    }
  }

  private async validatePluginConfigShape(pluginConfigs: Record<string, Record<string, any>>): Promise<void> {
    for (const [pluginId, cfg] of Object.entries(pluginConfigs)) {
      if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
        throw new Error(`插件配置格式错误: ${pluginId}`)
      }
    }
  }

  private async getMissingTenantTables(): Promise<string[]> {
    const conn = await mysql.createConnection(this.config.mysqlUrl)
    try {
      const [rows] = await conn.query<any[]>('SHOW TABLES')
      const tableSet = new Set(rows.map((r) => String(Object.values(r)[0])))
      return this.requiredTenantTables.filter((t) => !tableSet.has(t))
    } finally {
      await conn.end()
    }
  }

  private async verifyTenantTables(): Promise<void> {
    const missing = await this.getMissingTenantTables()
    if (missing.length > 0) {
      throw new Error(`租户数据库缺少插件表: ${missing.join(', ')}`)
    }
  }

  async diagnoseInstance(tenantId: string): Promise<InstanceDiagnosis> {
    const info = this.instances.get(tenantId)
    const missingTables = await this.getMissingTenantTables()
    return {
      tenantId,
      tracked: !!info,
      status: info?.status ?? 'stopped',
      pid: info?.process?.pid ?? null,
      lastHeartbeat: info?.lastHeartbeat ?? null,
      missingTables,
      checks: {
        tenantTablesOk: missingTables.length === 0,
        processTracked: !!info,
      },
    }
  }


  /** 启动 Bot 实例 */
  async startInstance(tenantId: string): Promise<InstanceInfo> {
    // 检查是否已在运行
    if (this.instances.has(tenantId)) {
      const existing = this.instances.get(tenantId)!
      if (existing.status === 'running' || existing.status === 'starting') {
        throw new Error('实例已在运行中')
      }
      // 清理旧实例
      await this.stopInstance(tenantId)
    }

    // 获取 Bot Token
    const botToken = await this.tenantService.getDecryptedToken(tenantId)
    if (!botToken) throw new Error('无法获取 Bot Token')

    const tenant = await this.tenantService.getById(tenantId)
    if (!tenant) throw new Error('租户不存在')

    // 获取已启用的插件及其配置
    const enabledPlugins = await this.subscriptionService.getEnabledPluginIds(tenantId)
    const pluginConfigs = await this.subscriptionService.getEnabledPluginConfigs(tenantId)

    // 启动前预检（token/配置/表）
    await this.runPreflightChecks(botToken, pluginConfigs)

    // 构建配置
    const instanceConfig: InstanceConfig = {
      tenantId,
      botToken,
      enabledPlugins,
      pluginConfigs,
      mysqlUrl: this.config.mysqlUrl,
      redisUrl: this.config.redisUrl,
    }

    // Fork 子进程
    const child = fork(this.config.engineEntryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV },
    })

    const info: InstanceInfo = {
      tenantId,
      process: child,
      status: 'starting',
      lastHeartbeat: Date.now(),
      restartCount: 0,
    }

    this.instances.set(tenantId, info)

    // 发送配置给子进程
    child.send({ type: 'start', config: instanceConfig })

    // 监听子进程消息
    child.on('message', (msg: any) => {
      if (msg.type === 'heartbeat') {
        info.lastHeartbeat = Date.now()
        this.tenantService.updateHeartbeat(tenantId).catch(() => {})
      } else if (msg.type === 'status' && msg.status === 'running') {
        info.status = 'running'
        this.tenantService.updateStatus(tenantId, 'running', child.pid).catch(() => {})
        console.info(`[InstanceManager] 实例 ${tenantId} 启动成功 (WebSocket)`)
      } else if (msg.type === 'error') {
        info.status = 'error'
        this.tenantService.updateStatus(tenantId, 'error').catch(() => {})
        console.error(`[InstanceManager] 实例 ${tenantId} 报错:`, msg.error)
      } else if (msg.type === 'log' && this.logService) {
        this.logService.writeLog({
          tenantId: msg.tenantId || tenantId,
          level: msg.level || 'info',
          message: msg.message || '',
          metadata: msg.metadata,
        }).catch(() => {})
      }
    })

    // 监听子进程退出
    child.on('exit', (code, signal) => {
      console.warn(`[InstanceManager] 实例 ${tenantId} 退出, code=${code}, signal=${signal}`)
      info.status = 'error'
      this.instances.delete(tenantId)
      this.tenantService.updateStatus(tenantId, 'stopped', null, null).catch(() => {})
    })

    // 捕获 stderr
    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[Instance:${tenantId}] ${data.toString().trim()}`)
    })

    // 捕获 stdout
    child.stdout?.on('data', (data: Buffer) => {
      console.info(`[Instance:${tenantId}] ${data.toString().trim()}`)
    })

    // 更新 DB 状态
    await this.tenantService.updateStatus(tenantId, 'starting', child.pid)

    return info
  }

  /** 停止 Bot 实例 */
  async stopInstance(tenantId: string): Promise<void> {
    const info = this.instances.get(tenantId)
    if (!info) return

    info.status = 'stopping'

    return new Promise<void>((resolve) => {
      let cleaned = false
      const timeout = setTimeout(() => {
        try { info.process.kill('SIGKILL') } catch {}
        cleanup()
      }, 5000)

      const cleanup = () => {
        if (cleaned) return
        cleaned = true
        clearTimeout(timeout)
        this.instances.delete(tenantId)
        this.tenantService.updateStatus(tenantId, 'stopped', null, null).catch(() => {})
        resolve()
      }

      info.process.once('exit', cleanup)

      // 发送优雅关闭信号
      try {
        info.process.send({ type: 'stop' })
      } catch {
        try { info.process.kill('SIGTERM') } catch {}
      }
    })
  }

  /** 重启实例 */
  async restartInstance(tenantId: string): Promise<InstanceInfo> {
    await this.stopInstance(tenantId)
    // 等 1 秒再启动
    await new Promise(r => setTimeout(r, 1000))
    const info = await this.startInstance(tenantId)
    info.restartCount++
    return info
  }

  /** 获取实例状态 */
  getInstanceStatus(tenantId: string): InstanceInfo | null {
    return this.instances.get(tenantId) ?? null
  }

  /** 获取所有实例 */
  getAllInstances(): Map<string, InstanceInfo> {
    return this.instances
  }

  /** 停止所有实例 */
  async stopAll(): Promise<void> {
    const stops = Array.from(this.instances.keys()).map(id => this.stopInstance(id))
    await Promise.allSettled(stops)
  }
}
