import { eq, and } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { pluginKeywordReplies } from './schema.js'

export class KeywordReplyService {
  private cache = new Map<string, Array<{
    id: number; keyword: string; reply: string; matchType: string
  }>>()

  constructor(private ctx: PluginContext) {}

  async init(): Promise<void> {
    const rows = await this.ctx.db.drizzle
      .select()
      .from(pluginKeywordReplies)
      .where(and(
        eq(pluginKeywordReplies.tenantId, this.ctx.tenantId),
        eq(pluginKeywordReplies.enabled, 1),
      ))

    for (const row of rows) {
      if (!this.cache.has(row.guildId)) this.cache.set(row.guildId, [])
      this.cache.get(row.guildId)!.push({
        id: row.id, keyword: row.keyword, reply: row.reply,
        matchType: row.matchType ?? 'contains',
      })
    }
    this.ctx.logger.info(`加载 ${rows.length} 条关键词规则`)
  }

  async check(content: string, guildId: string, channelId: string, msgId: string): Promise<boolean> {
    const rules = this.cache.get(guildId) ?? []
    const lower = content.toLowerCase()

    for (const rule of rules) {
      const kw = rule.keyword.toLowerCase()
      let matched = false
      switch (rule.matchType) {
        case 'exact':    matched = lower === kw; break
        case 'prefix':   matched = lower.startsWith(kw); break
        case 'suffix':   matched = lower.endsWith(kw); break
        case 'contains':
        default:         matched = lower.includes(kw); break
      }
      if (matched) {
        await this.ctx.kookApi.replyMessage(channelId, msgId, rule.reply)
        return true
      }
    }
    return false
  }

  invalidateCache(guildId: string): void {
    this.cache.delete(guildId)
  }

  async reloadGuild(guildId: string): Promise<void> {
    const rows = await this.ctx.db.drizzle
      .select()
      .from(pluginKeywordReplies)
      .where(and(
        eq(pluginKeywordReplies.tenantId, this.ctx.tenantId),
        eq(pluginKeywordReplies.guildId, guildId),
        eq(pluginKeywordReplies.enabled, 1),
      ))
    this.cache.set(guildId, rows.map((r: any) => ({
      id: r.id, keyword: r.keyword, reply: r.reply, matchType: r.matchType ?? 'contains',
    })))
  }
}
