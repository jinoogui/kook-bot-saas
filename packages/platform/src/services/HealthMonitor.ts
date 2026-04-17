import type { InstanceManager } from './InstanceService.js'
import type { TenantService } from './TenantService.js'

interface HealthMonitorAlert {
  type: 'heartbeat_timeout' | 'restart_failed' | 'restart_limit_reached' | 'recover_failed'
  tenantId: string
  message: string
  details?: Record<string, unknown>
}

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
  private readonly alertWebhookUrl = process.env.MONITOR_ALERT_WEBHOOK || process.env.ALERT_WEBHOOK || ''
  private readonly alertCooldownMs = 300_000
  private readonly lastAlertAt = new Map<string, number>()

  constructor(
    private instanceManager: InstanceManager,
    private tenantService: TenantService,
  ) {}

  private shouldSendAlert(key: string): boolean {
    const now = Date.now()
    const last = this.lastAlertAt.get(key) ?? 0
    if (now - last < this.alertCooldownMs) return false
    this.lastAlertAt.set(key, now)
    return true
  }

  private async sendAlert(alert: HealthMonitorAlert): Promise<void> {
    if (!this.alertWebhookUrl) return
    const key = `${alert.type}:${alert.tenantId}`
    if (!this.shouldSendAlert(key)) return

    try {
      await fetch(this.alertWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'kook-saas-health-monitor',
          at: new Date().toISOString(),
          ...alert,
        }),
      })
    } catch (err) {
      console.error('[HealthMonitor] 发送告警失败:', err)
    }
  }

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
        const timeoutSeconds = Math.floor(elapsed / 1000)
        console.warn(`[HealthMonitor] 实例 ${tenantId} 心跳超时 (${timeoutSeconds}s)`)
        await this.sendAlert({
          type: 'heartbeat_timeout',
          tenantId,
          message: `实例心跳超时 ${timeoutSeconds}s`,
          details: { elapsedMs: elapsed, restartCount: info.restartCount },
        })

        if (info.restartCount >= this.maxRestarts) {
          console.error(`[HealthMonitor] 实例 ${tenantId} 已重启 ${this.maxRestarts} 次，停止重试`)
          await this.instanceManager.stopInstance(tenantId)
          await this.tenantService.updateStatus(tenantId, 'error')
          await this.sendAlert({
            type: 'restart_limit_reached',
            tenantId,
            message: `实例重启次数达到上限 ${this.maxRestarts}`,
            details: { restartCount: info.restartCount },
          })
          continue
        }

        try {
          console.info(`[HealthMonitor] 重启实例 ${tenantId} (第 ${info.restartCount + 1} 次)`)
          await this.instanceManager.restartInstance(tenantId)
        } catch (err: any) {
          console.error(`[HealthMonitor] 重启实例 ${tenantId} 失败:`, err)
          await this.sendAlert({
            type: 'restart_failed',
            tenantId,
            message: '实例自动重启失败',
            details: { error: err?.message || String(err), restartCount: info.restartCount },
          })
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
        } catch (err: any) {
          console.error(`[HealthMonitor] 恢复实例 ${tenant.id} 失败:`, err)
          await this.tenantService.updateStatus(tenant.id, 'error')
          await this.sendAlert({
            type: 'recover_failed',
            tenantId: tenant.id,
            message: '启动恢复实例失败',
            details: { tenantName: tenant.name, error: err?.message || String(err) },
          })
        }
      }
    } catch (err) {
      console.error('[HealthMonitor] 恢复实例失败:', err)
    }
  }
}
