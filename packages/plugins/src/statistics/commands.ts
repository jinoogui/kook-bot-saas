import type { CommandDefinition, PluginContext } from '@kook-saas/shared'
import { StatisticsService } from './service.js'

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: 'stats',
      aliases: ['统计', 'online', '在线'],
      description: '查看活跃统计和排行',
      handler: async (event: any, args: string[], ctx: PluginContext) => {
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!guildId) return

        const service = new StatisticsService(ctx)
        const sub = args[0]

        if (sub === 'online' || sub === '在线') {
          const days = parseInt(args[1]) || 7
          const history = await service.getOnlineHistory(guildId, days)
          if (!history.length) {
            await ctx.kookApi.sendKmarkdownMessage(channelId, '📊 暂无在线统计数据')
            return
          }
          const lines = history.slice(0, 10).map((h: any) =>
            `${new Date(h.timestamp).toLocaleString('zh-CN')}: ${h.onlineCount}人`
          )
          await ctx.kookApi.sendKmarkdownMessage(channelId, `📊 **在线统计（最近${days}天）**\n\n${lines.join('\n')}`)
        } else if (sub === 'ranking' || sub === '排行') {
          const topUsers = await service.getTopUsers(guildId, 10)
          if (!topUsers.length) {
            await ctx.kookApi.sendKmarkdownMessage(channelId, '📊 暂无活跃数据')
            return
          }
          const lines = topUsers.map((u: any, i: number) =>
            `${i + 1}. (met)${u.userId}(met) - ${u.messageCount}条消息`
          )
          await ctx.kookApi.sendKmarkdownMessage(channelId, `🏆 **活跃排行榜**\n\n${lines.join('\n')}`)
        } else {
          // Default: show active user count
          const count = await service.getOnlineCount(guildId)
          await ctx.kookApi.sendKmarkdownMessage(channelId, `👥 当前活跃用户数：**${count}**`)
        }
      },
    },
  ]
}
