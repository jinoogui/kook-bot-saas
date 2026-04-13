import { eq, and, desc, sql } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { pluginStatsActivityStats, pluginStatsOnlineStats, pluginStatsUserActivity } from './schema.js'

export class StatisticsService {
  constructor(private ctx: PluginContext) {}

  async getOnlineCount(guildId: string): Promise<number> {
    const result = await this.ctx.db.drizzle
      .select({ count: sql<number>`count(*)` })
      .from(pluginStatsUserActivity)
      .where(and(
        eq(pluginStatsUserActivity.tenantId, this.ctx.tenantId),
        eq(pluginStatsUserActivity.guildId, guildId),
      ))
    return result[0]?.count || 0
  }

  async recordOnlineCount(guildId: string, count: number) {
    await this.ctx.db.drizzle.insert(pluginStatsOnlineStats).values({
      tenantId: this.ctx.tenantId,
      guildId,
      timestamp: new Date(),
      onlineCount: count,
    })
  }

  async getOnlineHistory(guildId: string, days: number = 7) {
    const since = new Date(Date.now() - days * 86400000)
    return await this.ctx.db.drizzle
      .select()
      .from(pluginStatsOnlineStats)
      .where(and(
        eq(pluginStatsOnlineStats.tenantId, this.ctx.tenantId),
        eq(pluginStatsOnlineStats.guildId, guildId),
        sql`${pluginStatsOnlineStats.timestamp} >= ${since}`,
      ))
      .orderBy(desc(pluginStatsOnlineStats.timestamp))
      .limit(100)
  }

  async getTopUsers(guildId: string, limit: number = 10) {
    return await this.ctx.db.drizzle
      .select()
      .from(pluginStatsUserActivity)
      .where(and(
        eq(pluginStatsUserActivity.tenantId, this.ctx.tenantId),
        eq(pluginStatsUserActivity.guildId, guildId),
      ))
      .orderBy(desc(pluginStatsUserActivity.messageCount))
      .limit(limit)
  }

  async trackMessage(userId: string, guildId: string) {
    await this.ctx.db.drizzle
      .insert(pluginStatsUserActivity)
      .values({
        tenantId: this.ctx.tenantId,
        userId,
        guildId,
        messageCount: 1,
        lastActiveAt: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          messageCount: sql`message_count + 1`,
          lastActiveAt: new Date(),
        },
      })
  }
}
