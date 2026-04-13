import { eq, and } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { pluginWelcomeMessages } from './schema.js'

export class WelcomeService {
  constructor(private ctx: PluginContext) {}

  async getConfig(guildId: string) {
    const [row] = await this.ctx.db.drizzle
      .select()
      .from(pluginWelcomeMessages)
      .where(
        and(
          eq(pluginWelcomeMessages.tenantId, this.ctx.tenantId),
          eq(pluginWelcomeMessages.guildId, guildId),
        ),
      )
      .limit(1)
    return row ?? null
  }

  async updateConfig(
    guildId: string,
    data: {
      content?: string
      channelId?: string
      enabled?: number
      messageType?: string
      cardContent?: string
    },
  ): Promise<void> {
    const existing = await this.getConfig(guildId)
    if (existing) {
      await this.ctx.db.drizzle
        .update(pluginWelcomeMessages)
        .set(data)
        .where(
          and(
            eq(pluginWelcomeMessages.tenantId, this.ctx.tenantId),
            eq(pluginWelcomeMessages.guildId, guildId),
          ),
        )
    } else {
      await this.ctx.db.drizzle
        .insert(pluginWelcomeMessages)
        .values({
          tenantId: this.ctx.tenantId,
          guildId,
          ...data,
        })
    }
  }

  async formatMessage(
    template: string,
    userId: string,
    guildId: string,
    username: string,
  ): Promise<string> {
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

    return template
      .replace(/\{user\}/g, `(met)${userId}(met)`)
      .replace(/\{user_id\}/g, userId)
      .replace(/\{user_name\}/g, username)
      .replace(/\{username\}/g, username)
      .replace(/\{guild_id\}/g, guildId)
      .replace(/\{time\}/g, now)
  }

  private async replaceCardVariables(
    cards: any[],
    userId: string,
    guildId: string,
    username: string,
  ): Promise<any[]> {
    const doReplace = async (obj: any): Promise<any> => {
      if (typeof obj === 'string') {
        return this.formatMessage(obj, userId, guildId, username)
      }
      if (Array.isArray(obj)) {
        return Promise.all(obj.map(item => doReplace(item)))
      }
      if (obj && typeof obj === 'object') {
        const result: any = {}
        for (const [key, val] of Object.entries(obj)) {
          result[key] = await doReplace(val)
        }
        return result
      }
      return obj
    }
    return doReplace(cards)
  }

  async onUserJoin(userId: string, guildId: string, username: string): Promise<void> {
    try {
      const cfg = await this.getConfig(guildId)
      if (!cfg || !cfg.enabled) return

      const channelId = cfg.channelId
      if (!channelId) return

      if (cfg.messageType === 'card' && cfg.cardContent) {
        const cards = JSON.parse(cfg.cardContent)
        const replaced = await this.replaceCardVariables(cards, userId, guildId, username)
        await this.ctx.kookApi.sendCardMessage(channelId, replaced)
      } else {
        const template = cfg.content ?? '欢迎 {user} 加入服务器！'
        const message = await this.formatMessage(template, userId, guildId, username)
        await this.ctx.kookApi.sendKmarkdownMessage(channelId, message)
      }
    } catch (err) {
      this.ctx.logger.error('发送欢迎消息失败:', err)
    }
  }

  async onUserLeave(userId: string, guildId: string, username: string): Promise<void> {
    try {
      const config = await this.ctx.getConfig()
      const goodbyeEnabled = config.goodbye_enabled ?? false
      if (!goodbyeEnabled) return

      const channelId = config.goodbye_channel_id ?? ''
      if (!channelId) return

      const template = config.goodbye_message ?? '{username} 离开了服务器，再见！'
      const message = await this.formatMessage(template, userId, guildId, username)

      await this.ctx.kookApi.sendKmarkdownMessage(channelId, message)
    } catch (err) {
      this.ctx.logger.error('发送欢送消息失败:', err)
    }
  }
}
