import { fork, type ChildProcess } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import type { TenantService } from './TenantService.js'
import type { SubscriptionService } from './SubscriptionService.js'
import type { LogService } from './LogService.js'

export interface InstanceInfo {
  tenantId: string
  process: ChildProcess
  port: number
  status: 'starting' | 'running' | 'stopping' | 'error'
  lastHeartbeat: number
  restartCount: number
}

export interface InstanceConfig {
  tenantId: string
  botToken: string
  verifyToken?: string
  encryptKey?: string
  port: number
  enabledPlugins: string[]
  mysqlUrl: string
  redisUrl: string
}

export class InstanceManager {
  private instances = new Map<string, InstanceInfo>()
  private portStart: number
  private portEnd: number
  private usedPorts = new Set<number>()

  constructor(
    private tenantService: TenantService,
    private subscriptionService: SubscriptionService,
    private config: {
      portStart: number
      portEnd: number
      mysqlUrl: string
      redisUrl: string
      engineEntryPath: string
    },
    private logService?: LogService,
  ) {
    this.portStart = config.portStart
    this.portEnd = config.portEnd
  }

  /** 分配一个可用端口 */
  private allocatePort(): number {
    for (let port = this.portStart; port <= this.portEnd; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port)
        return port
      }
    }
    throw new Error('没有可用端口，请扩大端口范围')
  }

  private releasePort(port: number) {
    this.usedPorts.delete(port)
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

    // 获取已启用的插件
    const enabledPlugins = await this.subscriptionService.getEnabledPluginIds(tenantId)

    // 分配端口
    const port = tenant.assignedPort ?? this.allocatePort()
    // Ensure assigned port is tracked
    if (tenant.assignedPort) {
      this.usedPorts.add(tenant.assignedPort)
    }

    // 构建配置
    const instanceConfig: InstanceConfig = {
      tenantId,
      botToken,
      verifyToken: tenant.verifyToken ?? undefined,
      encryptKey: tenant.encryptKey ?? undefined,
      port,
      enabledPlugins,
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
      port,
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
        this.tenantService.updateStatus(tenantId, 'running', child.pid, port).catch(() => {})
        console.info(`[InstanceManager] 实例 ${tenantId} 启动成功，端口 ${port}`)
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
      this.releasePort(port)
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
    await this.tenantService.updateStatus(tenantId, 'starting', child.pid, port)

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
        this.releasePort(info.port)
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
