import { eq, and, gt } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { pluginModerationBans, pluginModerationMutes, pluginModerationAds } from './schema.js'

export class ModerationService {
  constructor(private ctx: PluginContext) {}

  async banUser(userId: string, guildId: string, reason: string, bannedBy: string) {
    await this.ctx.db.drizzle.insert(pluginModerationBans).values({
      tenantId: this.ctx.tenantId, userId, guildId, reason, bannedBy,
    })
  }

  async unbanUser(userId: string, guildId: string) {
    await this.ctx.db.drizzle.delete(pluginModerationBans).where(and(
      eq(pluginModerationBans.tenantId, this.ctx.tenantId),
      eq(pluginModerationBans.userId, userId),
      eq(pluginModerationBans.guildId, guildId),
    ))
  }

  async isBanned(userId: string, guildId: string): Promise<boolean> {
    const [row] = await this.ctx.db.drizzle.select().from(pluginModerationBans)
      .where(and(
        eq(pluginModerationBans.tenantId, this.ctx.tenantId),
        eq(pluginModerationBans.userId, userId),
        eq(pluginModerationBans.guildId, guildId),
      )).limit(1)
    return !!row
  }

  async muteUser(userId: string, guildId: string, hours: number, mutedBy: string) {
    const muteUntil = new Date(Date.now() + hours * 3600000)
    await this.ctx.db.drizzle.insert(pluginModerationMutes).values({
      tenantId: this.ctx.tenantId, userId, guildId, muteUntil, mutedBy,
    })
  }

  async unmuteUser(userId: string, guildId: string) {
    await this.ctx.db.drizzle.delete(pluginModerationMutes).where(and(
      eq(pluginModerationMutes.tenantId, this.ctx.tenantId),
      eq(pluginModerationMutes.userId, userId),
      eq(pluginModerationMutes.guildId, guildId),
    ))
  }

  async isMuted(userId: string, guildId: string): Promise<boolean> {
    const now = new Date()
    const [row] = await this.ctx.db.drizzle.select().from(pluginModerationMutes)
      .where(and(
        eq(pluginModerationMutes.tenantId, this.ctx.tenantId),
        eq(pluginModerationMutes.userId, userId),
        eq(pluginModerationMutes.guildId, guildId),
        gt(pluginModerationMutes.muteUntil, now),
      )).limit(1)
    return !!row
  }

  async addAdKeyword(guildId: string, keyword: string) {
    await this.ctx.db.drizzle.insert(pluginModerationAds).values({
      tenantId: this.ctx.tenantId, guildId, keyword,
    })
  }

  async removeAdKeyword(guildId: string, keyword: string) {
    await this.ctx.db.drizzle.delete(pluginModerationAds).where(and(
      eq(pluginModerationAds.tenantId, this.ctx.tenantId),
      eq(pluginModerationAds.guildId, guildId),
      eq(pluginModerationAds.keyword, keyword),
    ))
  }

  async getAdKeywords(guildId: string) {
    return await this.ctx.db.drizzle.select().from(pluginModerationAds).where(and(
      eq(pluginModerationAds.tenantId, this.ctx.tenantId),
      eq(pluginModerationAds.guildId, guildId),
    ))
  }

  async getBans(guildId: string) {
    return await this.ctx.db.drizzle.select().from(pluginModerationBans).where(and(
      eq(pluginModerationBans.tenantId, this.ctx.tenantId),
      eq(pluginModerationBans.guildId, guildId),
    ))
  }
}
