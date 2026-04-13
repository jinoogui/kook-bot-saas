import type { InstanceManager } from './InstanceService.js'
import type { TenantService } from './TenantService.js'

/**
 * 健康监控器
 * 每 30 秒检查所有运行中的实例是否有心跳
 * 如果超过 90 秒没有心跳，自动重启
 */
export class HealthMonitor {
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly checkInterval = 30_000 // 30s
  private readonly heartbeatTimeout = 90_000 // 90s
  private readonly maxRestarts = 5

  constructor(
    private instanceManager: InstanceManager,
    private tenantService: TenantService,
  ) {}

  start(): void {
    if (this.timer) return

    this.timer = setInterval(() => {
      this.check().catch(err => {
        console.error('[HealthMonitor] 检查失败:', err)
      })
    }, this.checkInterval)

    console.info('[HealthMonitor] 启动，检查间隔 30s')
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    console.info('[HealthMonitor] 停止')
  }

  private async check(): Promise<void> {
    const instances = this.instanceManager.getAllInstances()
    const now = Date.now()

    for (const [tenantId, info] of instances) {
      if (info.status !== 'running') continue

      const elapsed = now - info.lastHeartbeat
      if (elapsed > this.heartbeatTimeout) {
        console.warn(`[HealthMonitor] 实例 ${tenantId} 心跳超时 (${Math.floor(elapsed / 1000)}s)`)

        if (info.restartCount >= this.maxRestarts) {
          console.error(`[HealthMonitor] 实例 ${tenantId} 已重启 ${this.maxRestarts} 次，停止重试`)
          await this.instanceManager.stopInstance(tenantId)
          await this.tenantService.updateStatus(tenantId, 'error')
          continue
        }

        try {
          console.info(`[HealthMonitor] 重启实例 ${tenantId} (第 ${info.restartCount + 1} 次)`)
          await this.instanceManager.restartInstance(tenantId)
        } catch (err) {
          console.error(`[HealthMonitor] 重启实例 ${tenantId} 失败:`, err)
        }
      }
    }
  }

  /** 启动时恢复之前运行中的实例 */
  async recoverInstances(): Promise<void> {
    try {
      const running = await this.tenantService.getAllRunning()
      console.info(`[HealthMonitor] 发现 ${running.length} 个需要恢复的实例`)

      for (const tenant of running) {
        try {
          console.info(`[HealthMonitor] 恢复实例 ${tenant.id} (${tenant.name})`)
          await this.instanceManager.startInstance(tenant.id)
        } catch (err) {
          console.error(`[HealthMonitor] 恢复实例 ${tenant.id} 失败:`, err)
          await this.tenantService.updateStatus(tenant.id, 'error')
        }
      }
    } catch (err) {
      console.error('[HealthMonitor] 恢复实例失败:', err)
    }
  }
}
