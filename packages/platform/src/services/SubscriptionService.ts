import { eq, and, lte } from 'drizzle-orm'
import type { PlatformDB } from '../db/index.js'
import { subscriptions, pluginCatalog } from '../db/schema/index.js'

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

  /** 订阅（购买）插件 */
  async subscribe(
    tenantId: string,
    pluginId: string,
    planType: 'monthly' | 'yearly' | 'lifetime' = 'monthly',
  ) {
    // 检查插件是否存在
    const [plugin] = await this.db
      .select()
      .from(pluginCatalog)
      .where(eq(pluginCatalog.id, pluginId))
      .limit(1)

    if (!plugin) throw new Error('插件不存在')

    // 计算过期时间
    let expiresAt: Date | null = null
    if (planType === 'monthly') {
      expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    } else if (planType === 'yearly') {
      expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    }
    // lifetime = null (never expires)

    // 免费插件直接订阅
    if (plugin.tier === 'free') {
      expiresAt = null // 免费永不过期
    }

    await this.db
      .insert(subscriptions)
      .values({
        tenantId,
        pluginId,
        status: 'active',
        planType: plugin.tier === 'free' ? 'lifetime' : planType,
        expiresAt,
        isEnabled: 1,
      })
      .onDuplicateKeyUpdate({
        set: {
          status: 'active',
          planType: plugin.tier === 'free' ? 'lifetime' : planType,
          expiresAt,
          isEnabled: 1,
        },
      })

    return { pluginId, planType, expiresAt }
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
        lte(subscriptions.expiresAt, now),
      ))
    return (result as any).affectedRows ?? 0
  }
}
