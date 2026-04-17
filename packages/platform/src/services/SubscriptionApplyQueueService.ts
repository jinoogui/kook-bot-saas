import type { PlatformDB } from '../db/index.js'
import type { TenantService } from './TenantService.js'
import type { InstanceManager } from './InstanceService.js'

interface QueueRow {
  id: number
  tenant_id: string
  reason: string
  payload: string | null
  retry_count: number
}

export class SubscriptionApplyQueueService {
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly intervalMs = 10_000
  private readonly maxRetries = 8

  constructor(
    private db: PlatformDB,
    private tenantService: TenantService,
    private instanceManager: InstanceManager,
  ) {}

  private get client(): { query: (sql: string, params?: any[]) => Promise<any[]> } {
    return (this.db as any).$client as { query: (sql: string, params?: any[]) => Promise<any[]> }
  }

  async start(): Promise<void> {
    await this.ensureTable()
    if (this.timer) return
    this.timer = setInterval(() => {
      this.processDue().catch((err) => {
        console.error('[SubscriptionApplyQueue] process error:', err)
      })
    }, this.intervalMs)
    console.info('[SubscriptionApplyQueue] started')
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
    console.info('[SubscriptionApplyQueue] stopped')
  }

  async enqueue(tenantId: string, reason: string, payload?: Record<string, unknown>): Promise<void> {
    const dedupeKey = tenantId
    const payloadText = payload ? JSON.stringify(payload) : null

    await this.client.query(
      `INSERT INTO subscription_apply_queue
        (dedupe_key, tenant_id, reason, payload, status, retry_count, next_retry_at, last_error)
       VALUES (?, ?, ?, ?, 'pending', 0, NULL, NULL)
       ON DUPLICATE KEY UPDATE
        tenant_id = VALUES(tenant_id),
        reason = VALUES(reason),
        payload = VALUES(payload),
        status = 'pending',
        next_retry_at = NULL,
        last_error = NULL`,
      [dedupeKey, tenantId, reason, payloadText],
    )
  }

  private async ensureTable(): Promise<void> {
    await this.client.query(
      `CREATE TABLE IF NOT EXISTS subscription_apply_queue (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        dedupe_key VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(36) NOT NULL,
        reason VARCHAR(64) NOT NULL,
        payload TEXT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        retry_count INT NOT NULL DEFAULT 0,
        next_retry_at TIMESTAMP NULL,
        last_error TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_apply_queue_dedupe (dedupe_key),
        KEY idx_apply_queue_status (status, next_retry_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    )
  }

  private async processDue(): Promise<void> {
    const [rows] = await this.client.query(
      `SELECT id
       FROM subscription_apply_queue
       WHERE status IN ('pending', 'failed')
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
       ORDER BY updated_at ASC
       LIMIT 20`,
    ) as [Array<{ id: number }>]

    for (const row of rows) {
      await this.processOne(row.id)
    }
  }

  private async processOne(id: number): Promise<void> {
    const [claimResult] = await this.client.query(
      `UPDATE subscription_apply_queue
       SET status = 'processing'
       WHERE id = ?
         AND status IN ('pending', 'failed')
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())`,
      [id],
    )

    const claimed = (claimResult as any)?.affectedRows ?? 0
    if (claimed === 0) return

    const [queueRows] = await this.client.query(
      `SELECT id, tenant_id, reason, payload, retry_count
       FROM subscription_apply_queue
       WHERE id = ?
       LIMIT 1`,
      [id],
    ) as [QueueRow[]]

    const row = queueRows[0]
    if (!row) return

    try {
      await this.applyRuntime(row.tenant_id)
      await this.client.query(
        `UPDATE subscription_apply_queue
         SET status = 'done', retry_count = 0, next_retry_at = NULL, last_error = NULL
         WHERE id = ?`,
        [id],
      )
    } catch (err: any) {
      const retryCount = row.retry_count + 1
      const capped = Math.min(retryCount, 8)
      const delaySec = Math.min(300, 5 * (2 ** (capped - 1)))
      const status = retryCount >= this.maxRetries ? 'dead' : 'failed'
      const message = (err?.message || String(err)).slice(0, 500)

      await this.client.query(
        `UPDATE subscription_apply_queue
         SET status = ?, retry_count = ?, next_retry_at = DATE_ADD(NOW(), INTERVAL ? SECOND), last_error = ?
         WHERE id = ?`,
        [status, retryCount, delaySec, message, id],
      )
    }
  }

  private async applyRuntime(tenantId: string): Promise<void> {
    const inMemory = this.instanceManager.getInstanceStatus(tenantId)
    const tenant = inMemory ? null : await this.tenantService.getById(tenantId)
    const status = inMemory?.status ?? tenant?.status ?? 'stopped'

    if (status === 'running') {
      await this.instanceManager.restartInstance(tenantId)
      return
    }

    if (status === 'starting' || status === 'stopping') {
      throw new Error('实例状态过渡中，等待重试')
    }
  }
}
