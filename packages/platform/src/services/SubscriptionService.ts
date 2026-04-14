import { eq, and, lte, isNotNull, or } from 'drizzle-orm'
import type { PlatformDB } from '../db/index.js'
import { subscriptions, pluginCatalog, payments } from '../db/schema/index.js'

export class SubscriptionService {
  constructor(private db: PlatformDB) {}

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
      try {
        result[s.pluginId] = s.configJson ? JSON.parse(s.configJson) : {}
      } catch {
        result[s.pluginId] = {}
      }
    }
    return result
  }

  /** 订阅（购买）插件 — 付费插件创建 pending 订阅 + pending 支付 */
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

    if (!plugin) throw new Error('插件不存在')

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

    // 付费插件：创建 pending 订阅 + pending 支付记录
    const amount = planType === 'yearly'
      ? (plugin.priceYearly ?? 0)
      : (plugin.priceMonthly ?? 0)

    // 创建或更新为 pending 订阅
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

    // 创建支付记录
    const [paymentResult] = await this.db
      .insert(payments)
      .values({
        userId: userId ?? 0,
        tenantId,
        pluginId,
        amount,
        provider: 'manual',
        status: 'pending',
      })
      .$returningId()

    const paymentId = paymentResult.id

    return {
      pluginId,
      planType,
      expiresAt: null,
      paymentRequired: true,
      paymentId,
      amount,
    }
  }

  /** 确认支付 — 激活订阅 */
  async confirmPayment(paymentId: number) {
    // 获取支付记录
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1)

    if (!payment) throw new Error('支付记录不存在')
    if (payment.status !== 'pending') throw new Error('该支付记录不是待确认状态')

    // 更新支付为已支付
    await this.db
      .update(payments)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(payments.id, paymentId))

    // 计算过期时间
    const [sub] = await this.db
      .select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.tenantId, payment.tenantId),
        eq(subscriptions.pluginId, payment.pluginId),
      ))
      .limit(1)

    let expiresAt: Date | null = null
    const planType = sub?.planType ?? 'monthly'
    if (planType === 'monthly') {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    } else if (planType === 'yearly') {
      expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    }
    // lifetime = null

    // 激活订阅
    await this.db
      .update(subscriptions)
      .set({
        status: 'active',
        isEnabled: 1,
        expiresAt,
        startedAt: new Date(),
      })
      .where(and(
        eq(subscriptions.tenantId, payment.tenantId),
        eq(subscriptions.pluginId, payment.pluginId),
      ))
  }

  /** 拒绝支付 — 取消 pending 订阅 */
  async rejectPayment(paymentId: number) {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1)

    if (!payment) throw new Error('支付记录不存在')
    if (payment.status !== 'pending') throw new Error('该支付记录不是待确认状态')

    // 更新支付为失败
    await this.db
      .update(payments)
      .set({ status: 'failed' })
      .where(eq(payments.id, paymentId))

    // 取消 pending 订阅
    await this.db
      .update(subscriptions)
      .set({ status: 'cancelled', isEnabled: 0 })
      .where(and(
        eq(subscriptions.tenantId, payment.tenantId),
        eq(subscriptions.pluginId, payment.pluginId),
        eq(subscriptions.status, 'pending'),
      ))
  }

  /** 取消订阅 */
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

  /** 更新插件配置 */
  async updateConfig(tenantId: string, pluginId: string, config: Record<string, any>) {
    await this.db
      .update(subscriptions)
      .set({ configJson: JSON.stringify(config) })
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.pluginId, pluginId),
      ))
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
