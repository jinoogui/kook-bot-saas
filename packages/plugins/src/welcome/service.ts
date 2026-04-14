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

  private async getRuntimeConfig(guildId: string): Promise<{
    enabled: boolean
    welcomeMessage: string
    welcomeChannelId: string
    messageType: 'kmarkdown' | 'card'
    cardContent: string
    goodbyeEnabled: boolean
    goodbyeMessage: string
    goodbyeChannelId: string
  }> {
    const cfg = await this.ctx.getConfig()
    const row = await this.getConfig(guildId)

    const enabled = cfg.enabled ?? row?.enabled ?? true
    const welcomeMessage = cfg.welcome_message ?? row?.content ?? '欢迎 {user} 加入服务器！'
    const welcomeChannelId = cfg.welcome_channel_id ?? row?.channelId ?? ''
    const messageType = (cfg.message_type ?? row?.messageType ?? 'kmarkdown') === 'card' ? 'card' : 'kmarkdown'
    const cardContent = cfg.card_content ?? row?.cardContent ?? ''

    return {
      enabled: !!enabled,
      welcomeMessage,
      welcomeChannelId,
      messageType,
      cardContent,
      goodbyeEnabled: !!(cfg.goodbye_enabled ?? false),
      goodbyeMessage: cfg.goodbye_message ?? '{username} 离开了服务器，再见！',
      goodbyeChannelId: cfg.goodbye_channel_id ?? '',
    }
  }

  async onUserJoin(userId: string, guildId: string, username: string): Promise<void> {
    try {
      const runtime = await this.getRuntimeConfig(guildId)
      if (!runtime.enabled) return
      if (!runtime.welcomeChannelId) return

      if (runtime.messageType === 'card' && runtime.cardContent) {
        const cards = JSON.parse(runtime.cardContent)
        const replaced = await this.replaceCardVariables(cards, userId, guildId, username)
        await this.ctx.kookApi.sendCardMessage(runtime.welcomeChannelId, replaced)
      } else {
        const message = await this.formatMessage(runtime.welcomeMessage, userId, guildId, username)
        await this.ctx.kookApi.sendKmarkdownMessage(runtime.welcomeChannelId, message)
      }
    } catch (err) {
      this.ctx.logger.error('发送欢迎消息失败:', err)
    }
  }

  async onUserLeave(userId: string, guildId: string, username: string): Promise<void> {
    try {
      const runtime = await this.getRuntimeConfig(guildId)
      if (!runtime.goodbyeEnabled) return
      if (!runtime.goodbyeChannelId) return

      const message = await this.formatMessage(runtime.goodbyeMessage, userId, guildId, username)
      await this.ctx.kookApi.sendKmarkdownMessage(runtime.goodbyeChannelId, message)
    } catch (err) {
      this.ctx.logger.error('发送欢送消息失败:', err)
    }
  }
}
