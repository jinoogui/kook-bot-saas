import type { CommandDefinition, KookMessageEvent, PluginContext } from '@kook-saas/shared'
import { ModerationService } from './service.js'

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: 'ban',
      aliases: ['封禁'],
      description: '封禁用户',
      permission: 'admin',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        const adminId = event.author_id
        if (!guildId || !adminId) return

        const userMatch = args[0]?.match(/@(\d+)/)
        const userId = userMatch?.[1]
        const reason = args.slice(1).join(' ') || '违反规则'

        if (!userId) {
          await ctx.kookApi.sendKmarkdownMessage(channelId, '❌ 请@要封禁的用户')
          return
        }

        const service = new ModerationService(ctx)
        await service.banUser(userId, guildId, reason, adminId)
        await ctx.kookApi.sendKmarkdownMessage(channelId, `✅ 已封禁用户 (met)${userId}(met)\n原因：${reason}`)
      },
    },
    {
      name: 'unban',
      aliases: ['解封'],
      description: '解封用户',
      permission: 'admin',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!guildId) return

        const userMatch = args[0]?.match(/@(\d+)/)
        const userId = userMatch?.[1]
        if (!userId) {
          await ctx.kookApi.sendKmarkdownMessage(channelId, '❌ 请@要解封的用户')
          return
        }

        const service = new ModerationService(ctx)
        await service.unbanUser(userId, guildId)
        await ctx.kookApi.sendKmarkdownMessage(channelId, `✅ 已解封用户 (met)${userId}(met)`)
      },
    },
    {
      name: 'mute',
      aliases: ['禁言'],
      description: '禁言用户',
      permission: 'admin',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        const adminId = event.author_id
        if (!guildId || !adminId) return

        const userMatch = args[0]?.match(/@(\d+)/)
        const userId = userMatch?.[1]
        const hours = parseInt(args[1]) || 1

        if (!userId) {
          await ctx.kookApi.sendKmarkdownMessage(channelId, '❌ 请@要禁言的用户')
          return
        }

        const service = new ModerationService(ctx)
        await service.muteUser(userId, guildId, hours, adminId)
        await ctx.kookApi.sendKmarkdownMessage(channelId, `✅ 已禁言用户 (met)${userId}(met) ${hours}小时`)
      },
    },
    {
      name: 'unmute',
      aliases: ['解除禁言'],
      description: '解除禁言',
      permission: 'admin',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!guildId) return

        const userMatch = args[0]?.match(/@(\d+)/)
        const userId = userMatch?.[1]
        if (!userId) {
          await ctx.kookApi.sendKmarkdownMessage(channelId, '❌ 请@要解除禁言的用户')
          return
        }

        const service = new ModerationService(ctx)
        await service.unmuteUser(userId, guildId)
        await ctx.kookApi.sendKmarkdownMessage(channelId, `✅ 已解除禁言 (met)${userId}(met)`)
      },
    },
    {
      name: 'ad',
      aliases: ['广告词'],
      description: '广告词管理 (add/remove/list)',
      permission: 'admin',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!guildId) return

        const service = new ModerationService(ctx)
        const sub = args[0]

        if (sub === 'add' || sub === '添加') {
          const keyword = args.slice(1).join(' ')
          if (!keyword) {
            await ctx.kookApi.sendKmarkdownMessage(channelId, '❌ 请输入广告关键词')
            return
          }
          await service.addAdKeyword(guildId, keyword)
          await ctx.kookApi.sendKmarkdownMessage(channelId, `✅ 已添加广告词：**${keyword}**`)
        } else if (sub === 'remove' || sub === '删除') {
          const keyword = args.slice(1).join(' ')
          if (!keyword) {
            await ctx.kookApi.sendKmarkdownMessage(channelId, '❌ 请输入要删除的关键词')
            return
          }
          await service.removeAdKeyword(guildId, keyword)
          await ctx.kookApi.sendKmarkdownMessage(channelId, `✅ 已删除广告词：**${keyword}**`)
        } else if (sub === 'list' || sub === '列表' || !sub) {
          const keywords = await service.getAdKeywords(guildId)
          if (!keywords.length) {
            await ctx.kookApi.sendKmarkdownMessage(channelId, '📋 当前没有自定义广告词')
            return
          }
          const lines = keywords.map((k: any, i: number) => `${i + 1}. ${k.keyword}`)
          await ctx.kookApi.sendKmarkdownMessage(channelId, `📋 **广告词列表**\n\n${lines.join('\n')}`)
        } else {
          await ctx.kookApi.sendKmarkdownMessage(channelId, '❌ 用法: /ad add|remove|list [关键词]')
        }
      },
    },
  ]
}
