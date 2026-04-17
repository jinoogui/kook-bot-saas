import { eq, and, lte, isNotNull, or } from 'drizzle-orm'
import type { ZodTypeAny } from 'zod'
import type { PlatformDB } from '../db/index.js'
import { subscriptions, pluginCatalog, payments } from '../db/schema/index.js'
import type { PaymentRiskDecision, PaymentRiskService } from './PaymentRiskService.js'

export class SubscriptionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'SubscriptionError'
  }
}

export interface PaymentTransitionResult {
  outcome: 'confirmed' | 'already_confirmed' | 'rejected' | 'already_rejected' | 'refunded' | 'already_refunded'
  tenantId: string
  pluginId: string
}

export interface SubscriptionConfigValidationIssue {
  path: string
  message: string
}

export type PluginConfigSchemaMap = Record<string, ZodTypeAny>

export class SubscriptionService {
  constructor(
    private db: PlatformDB,
    private paymentRiskService?: PaymentRiskService,
    private pluginConfigSchemaMap: PluginConfigSchemaMap = {},
  ) {}

  private getPluginSchema(pluginId: string): ZodTypeAny | undefined {
    return this.pluginConfigSchemaMap[pluginId]
  }

  private normalizeConfigObject(config: unknown): Record<string, any> {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new SubscriptionError('INVALID_PLUGIN_CONFIG', '插件配置必须是对象')
    }
    return config as Record<string, any>
  }

  private validateConfigBySchema(pluginId: string, config: Record<string, any>): Record<string, any> {
    const schema = this.getPluginSchema(pluginId)
    if (!schema) return config

    const parsed = schema.safeParse(config)
    if (!parsed.success) {
      const issues: SubscriptionConfigValidationIssue[] = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
      throw new SubscriptionError(
        'PLUGIN_CONFIG_VALIDATION_FAILED',
        '插件配置校验失败',
        { issues },
      )
    }

    const value = parsed.data
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new SubscriptionError('PLUGIN_CONFIG_VALIDATION_FAILED', '插件配置校验结果必须是对象')
    }
    return value as Record<string, any>
  }

  /** 获取租户的所有活跃订阅 */
  async getActiveSubscriptions(tenantId: string) {
    return this.db
      .select({
        id: subscriptions.id,
        pluginId: subscriptions.pluginId,
        status: subscriptions.status,
        planType: subscriptions.planType,
        isEnabled: subscriptions.isEnabled,
        startedAt: subscriptions.startedAt,
        expiresAt: subscriptions.expiresAt,
        configJson: subscriptions.configJson,
      })
      .from(subscriptions)
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.status, 'active'),
      ))
  }

  /** 获取租户所有订阅（含 pending），用于前端展示 */
  async getAllSubscriptions(tenantId: string) {
    return this.db
      .select({
        id: subscriptions.id,
        pluginId: subscriptions.pluginId,
        status: subscriptions.status,
        planType: subscriptions.planType,
        isEnabled: subscriptions.isEnabled,
        startedAt: subscriptions.startedAt,
        expiresAt: subscriptions.expiresAt,
        configJson: subscriptions.configJson,
        pluginName: pluginCatalog.name,
      })
      .from(subscriptions)
      .leftJoin(pluginCatalog, eq(subscriptions.pluginId, pluginCatalog.id))
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        or(
          eq(subscriptions.status, 'active'),
          eq(subscriptions.status, 'pending'),
        ),
      ))
  }

  /** 获取租户已启用的插件 ID 列表 */
  async getEnabledPluginIds(tenantId: string): Promise<string[]> {
    const subs = await this.db
      .select({ pluginId: subscriptions.pluginId })
      .from(subscriptions)
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.status, 'active'),
        eq(subscriptions.isEnabled, 1),
      ))
    return subs.map(s => s.pluginId)
  }

  /** 获取租户所有已启用插件的配置 */
  async getEnabledPluginConfigs(tenantId: string): Promise<Record<string, Record<string, any>>> {
    const subs = await this.db
      .select({
        pluginId: subscriptions.pluginId,
        configJson: subscriptions.configJson,
      })
      .from(subscriptions)
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.status, 'active'),
        eq(subscriptions.isEnabled, 1),
      ))
    const result: Record<string, Record<string, any>> = {}
    for (const s of subs) {
      if (!s.configJson) {
        result[s.pluginId] = this.validateConfigBySchema(s.pluginId, {})
        continue
      }
      try {
        const parsed = this.normalizeConfigObject(JSON.parse(s.configJson))
        result[s.pluginId] = this.validateConfigBySchema(s.pluginId, parsed)
      } catch (err: any) {
        throw new Error(`插件 ${s.pluginId} 配置格式错误: ${err?.message || '无效 JSON'}`)
      }
    }
    return result
  }

  /** 订阅（购买）插件 — 付费插件创建 pending 支付，已激活插件走续费 */
  async subscribe(
    tenantId: string,
    pluginId: string,
    planType: 'monthly' | 'yearly' | 'lifetime' = 'monthly',
    userId?: number,
  ) {
    // 检查插件是否存在
    const [plugin] = await this.db
      .select()
      .from(pluginCatalog)
      .where(eq(pluginCatalog.id, pluginId))
      .limit(1)

    if (!plugin) throw new SubscriptionError('PLUGIN_NOT_FOUND', '插件不存在')

    // 免费插件直接激活
    if (plugin.tier === 'free') {
      await this.db
        .insert(subscriptions)
        .values({
          tenantId,
          pluginId,
          status: 'active',
          planType: 'lifetime',
          expiresAt: null,
          isEnabled: 1,
        })
        .onDuplicateKeyUpdate({
          set: {
            status: 'active',
            planType: 'lifetime',
            expiresAt: null,
            isEnabled: 1,
          },
        })

      return { pluginId, planType: 'lifetime', expiresAt: null, paymentRequired: false }
    }

    // 付费插件只支持月付/年付
    if (!['monthly', 'yearly'].includes(planType)) {
      throw new SubscriptionError('INVALID_PLAN_TYPE', '付费插件仅支持月付或年付')
    }

    const amount = planType === 'yearly'
      ? (plugin.priceYearly ?? 0)
      : (plugin.priceMonthly ?? 0)

    // 避免重复下单：如果已有 pending 支付，直接返回该订单
    const [pendingPayment] = await this.db
      .select({ id: payments.id, amount: payments.amount })
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.pluginId, pluginId),
        eq(payments.status, 'pending'),
      ))
      .limit(1)

    if (pendingPayment) {
      return {
        pluginId,
        planType,
        expiresAt: null,
        paymentRequired: true,
        paymentId: pendingPayment.id,
        amount: pendingPayment.amount,
        reusedPendingPayment: true,
      }
    }

    const [existingSub] = await this.db
      .select({ id: subscriptions.id, status: subscriptions.status })
      .from(subscriptions)
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.pluginId, pluginId),
      ))
      .limit(1)

    // 非 active 订阅进入 pending，active 订阅保持运行态（续费流程）
    if (!existingSub || existingSub.status !== 'active') {
      await this.db
        .insert(subscriptions)
        .values({
          tenantId,
          pluginId,
          status: 'pending',
          planType,
          expiresAt: null,
          isEnabled: 0,
        })
        .onDuplicateKeyUpdate({
          set: {
            status: 'pending',
            planType,
            expiresAt: null,
            isEnabled: 0,
          },
        })
    } else {
      await this.db
        .update(subscriptions)
        .set({ planType })
        .where(and(
          eq(subscriptions.tenantId, tenantId),
          eq(subscriptions.pluginId, pluginId),
          eq(subscriptions.status, 'active'),
        ))
    }

    const riskEvaluation = this.paymentRiskService
      ? await this.paymentRiskService.evaluateCreateOrder({
        userId: userId ?? 0,
        tenantId,
        pluginId,
        amount,
      })
      : {
        decision: 'pass' as PaymentRiskDecision,
        reason: null,
        recentOrderCount: 0,
      }

    const paymentStatus = riskEvaluation.decision === 'reject' ? 'failed' : 'pending'

    // 创建支付记录
    const [paymentResult] = await this.db
      .insert(payments)
      .values({
        userId: userId ?? 0,
        tenantId,
        pluginId,
        amount,
        provider: 'manual',
        status: paymentStatus,
        riskDecision: riskEvaluation.decision,
        riskReason: riskEvaluation.reason,
        riskCheckedAt: new Date(),
      })
      .$returningId()

    if (riskEvaluation.decision === 'reject') {
      await this.db
        .update(subscriptions)
        .set({ status: 'cancelled', isEnabled: 0 })
        .where(and(
          eq(subscriptions.tenantId, tenantId),
          eq(subscriptions.pluginId, pluginId),
          eq(subscriptions.status, 'pending'),
        ))

      throw new SubscriptionError('PAYMENT_RISK_REJECTED', riskEvaluation.reason || '订单触发风控自动拒绝')
    }

    return {
      pluginId,
      planType,
      expiresAt: null,
      paymentRequired: true,
      paymentId: paymentResult.id,
      amount,
      renewal: !!existingSub && existingSub.status === 'active',
      riskDecision: riskEvaluation.decision,
      riskReason: riskEvaluation.reason,
      reviewRequired: riskEvaluation.decision === 'review',
    }
  }

  /** 确认支付 — 激活订阅（幂等） */
  async confirmPayment(paymentId: number): Promise<PaymentTransitionResult> {
    const conn = (this.db as any).$client as { getConnection: () => Promise<any> } | undefined
    if (!conn) {
      throw new SubscriptionError('DB_CLIENT_UNAVAILABLE', '数据库连接不可用')
    }

    const tx = await conn.getConnection()
    try {
      await tx.beginTransaction()

      const [paymentRows] = await tx.query(
        'SELECT id, tenant_id, plugin_id, status FROM payments WHERE id = ? FOR UPDATE',
        [paymentId],
      ) as [any[]]
      const payment = paymentRows?.[0]
      if (!payment) {
        throw new SubscriptionError('PAYMENT_NOT_FOUND', '支付记录不存在')
      }

      if (payment.status === 'paid') {
        await tx.commit()
        return {
          outcome: 'already_confirmed',
          tenantId: payment.tenant_id,
          pluginId: payment.plugin_id,
        }
      }

      if (payment.status !== 'pending') {
        throw new SubscriptionError('PAYMENT_STATE_CONFLICT', '该支付记录不是待确认状态')
      }

      const [subRows] = await tx.query(
        'SELECT id, plan_type, status, expires_at, started_at FROM subscriptions WHERE tenant_id = ? AND plugin_id = ? FOR UPDATE',
        [payment.tenant_id, payment.plugin_id],
      ) as [any[]]
      const sub = subRows?.[0]
      if (!sub) {
        throw new SubscriptionError('SUBSCRIPTION_NOT_FOUND', '关联订阅不存在')
      }

      const now = Date.now()
      const currentExpires = sub.expires_at ? new Date(sub.expires_at).getTime() : now
      const baseTime = currentExpires > now ? currentExpires : now

      let expiresAt: Date | null = null
      const planType = sub.plan_type ?? 'monthly'
      if (planType === 'monthly') {
        expiresAt = new Date(baseTime + 30 * 24 * 60 * 60 * 1000)
      } else if (planType === 'yearly') {
        expiresAt = new Date(baseTime)
        expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      }

      await tx.query(
        'UPDATE payments SET status = ?, paid_at = ? WHERE id = ?',
        ['paid', new Date(), paymentId],
      )

      await tx.query(
        'UPDATE subscriptions SET status = ?, is_enabled = 1, expires_at = ?, started_at = ? WHERE id = ?',
        ['active', expiresAt, sub.status === 'active' ? sub.started_at ?? new Date() : new Date(), sub.id],
      )

      await tx.commit()
      return {
        outcome: 'confirmed',
        tenantId: payment.tenant_id,
        pluginId: payment.plugin_id,
      }
    } catch (err) {
      await tx.rollback()
      throw err
    } finally {
      tx.release()
    }
  }

  /** 拒绝支付 — 取消 pending 订阅（幂等） */
  async rejectPayment(paymentId: number): Promise<PaymentTransitionResult> {
    const conn = (this.db as any).$client as { getConnection: () => Promise<any> } | undefined
    if (!conn) {
      throw new SubscriptionError('DB_CLIENT_UNAVAILABLE', '数据库连接不可用')
    }

    const tx = await conn.getConnection()
    try {
      await tx.beginTransaction()

      const [paymentRows] = await tx.query(
        'SELECT id, tenant_id, plugin_id, status FROM payments WHERE id = ? FOR UPDATE',
        [paymentId],
      ) as [any[]]
      const payment = paymentRows?.[0]
      if (!payment) {
        throw new SubscriptionError('PAYMENT_NOT_FOUND', '支付记录不存在')
      }

      if (payment.status === 'failed') {
        await tx.commit()
        return {
          outcome: 'already_rejected',
          tenantId: payment.tenant_id,
          pluginId: payment.plugin_id,
        }
      }

      if (payment.status !== 'pending') {
        throw new SubscriptionError('PAYMENT_STATE_CONFLICT', '该支付记录不是待确认状态')
      }

      await tx.query('UPDATE payments SET status = ? WHERE id = ?', ['failed', paymentId])

      await tx.query(
        'UPDATE subscriptions SET status = ?, is_enabled = 0 WHERE tenant_id = ? AND plugin_id = ? AND status = ?',
        ['cancelled', payment.tenant_id, payment.plugin_id, 'pending'],
      )

      await tx.commit()
      return {
        outcome: 'rejected',
        tenantId: payment.tenant_id,
        pluginId: payment.plugin_id,
      }
    } catch (err) {
      await tx.rollback()
      throw err
    } finally {
      tx.release()
    }
  }

  /** 退款 — 关闭已支付订单并停用订阅（幂等） */
  async refundPayment(paymentId: number): Promise<PaymentTransitionResult> {
    const conn = (this.db as any).$client as { getConnection: () => Promise<any> } | undefined
    if (!conn) {
      throw new SubscriptionError('DB_CLIENT_UNAVAILABLE', '数据库连接不可用')
    }

    const tx = await conn.getConnection()
    try {
      await tx.beginTransaction()

      const [paymentRows] = await tx.query(
        'SELECT id, tenant_id, plugin_id, status FROM payments WHERE id = ? FOR UPDATE',
        [paymentId],
      ) as [any[]]
      const payment = paymentRows?.[0]
      if (!payment) {
        throw new SubscriptionError('PAYMENT_NOT_FOUND', '支付记录不存在')
      }

      if (payment.status === 'refunded') {
        await tx.commit()
        return {
          outcome: 'already_refunded',
          tenantId: payment.tenant_id,
          pluginId: payment.plugin_id,
        }
      }

      if (payment.status !== 'paid') {
        throw new SubscriptionError('PAYMENT_STATE_CONFLICT', '仅已支付订单可退款')
      }

      await tx.query('UPDATE payments SET status = ? WHERE id = ?', ['refunded', paymentId])

      await tx.query(
        'UPDATE subscriptions SET status = ?, is_enabled = 0 WHERE tenant_id = ? AND plugin_id = ? AND status = ?',
        ['cancelled', payment.tenant_id, payment.plugin_id, 'active'],
      )

      await tx.commit()
      return {
        outcome: 'refunded',
        tenantId: payment.tenant_id,
        pluginId: payment.plugin_id,
      }
    } catch (err) {
      await tx.rollback()
      throw err
    } finally {
      tx.release()
    }
  }

  async unsubscribe(tenantId: string, pluginId: string) {
    await this.db
      .update(subscriptions)
      .set({ status: 'cancelled', isEnabled: 0 })
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.pluginId, pluginId),
      ))
  }

  /** 启用/禁用已订阅插件 */
  async togglePlugin(tenantId: string, pluginId: string, enabled: boolean) {
    await this.db
      .update(subscriptions)
      .set({ isEnabled: enabled ? 1 : 0 })
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.pluginId, pluginId),
        eq(subscriptions.status, 'active'),
      ))
  }

  async assertRuntimeAccessible(tenantId: string, pluginId: string): Promise<void> {
    const [plugin] = await this.db
      .select({ id: pluginCatalog.id, enabled: pluginCatalog.enabled })
      .from(pluginCatalog)
      .where(eq(pluginCatalog.id, pluginId))
      .limit(1)

    if (!plugin || plugin.enabled !== 1) {
      throw new SubscriptionError('PLUGIN_NOT_AVAILABLE', '插件不存在或已下线')
    }

    const [sub] = await this.db
      .select({ status: subscriptions.status, isEnabled: subscriptions.isEnabled })
      .from(subscriptions)
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.pluginId, pluginId),
      ))
      .limit(1)

    if (!sub) {
      throw new SubscriptionError('PLUGIN_NOT_SUBSCRIBED', '插件尚未订阅')
    }

    if (sub.status !== 'active') {
      throw new SubscriptionError('PLUGIN_NOT_ACTIVE', '插件订阅未激活')
    }

    if (sub.isEnabled !== 1) {
      throw new SubscriptionError('PLUGIN_DISABLED', '插件已被禁用')
    }
  }

  /** 更新插件配置（仅 active 订阅可写） */
  async updateConfig(tenantId: string, pluginId: string, config: Record<string, any>) {
    const [plugin] = await this.db
      .select({ id: pluginCatalog.id, enabled: pluginCatalog.enabled })
      .from(pluginCatalog)
      .where(eq(pluginCatalog.id, pluginId))
      .limit(1)

    if (!plugin || plugin.enabled !== 1) {
      throw new SubscriptionError('PLUGIN_NOT_AVAILABLE', '插件不存在或已下线')
    }

    const safeConfig = this.normalizeConfigObject(config)
    const validatedConfig = this.validateConfigBySchema(pluginId, safeConfig)

    const result = await this.db
      .update(subscriptions)
      .set({ configJson: JSON.stringify(validatedConfig) })
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.pluginId, pluginId),
        eq(subscriptions.status, 'active'),
      ))

    const affectedRows = (result as any)?.affectedRows ?? 0
    if (affectedRows === 0) {
      throw new SubscriptionError('SUBSCRIPTION_NOT_ACTIVE', '仅激活订阅可配置')
    }

    return validatedConfig
  }

  /** 检查过期订阅并标记 */
  async expireOverdue(): Promise<number> {
    const now = new Date()
    const result = await this.db
      .update(subscriptions)
      .set({ status: 'expired', isEnabled: 0 })
      .where(and(
        eq(subscriptions.status, 'active'),
        isNotNull(subscriptions.expiresAt),
        lte(subscriptions.expiresAt, now),
      ))
    return (result as any).affectedRows ?? 0
  }
}
