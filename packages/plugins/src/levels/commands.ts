import type { CommandDefinition, KookMessageEvent, PluginContext } from '@kook-saas/shared'
import { LevelService } from './service.js'

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: 'level',
      aliases: ['等级', 'lv'],
      description: '查看等级信息',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, _args: string[], ctx: PluginContext): Promise<void> => {
        const userId = event.author_id
        const guildId = event.extra?.guild_id
        const channelId = event.target_id
        if (!userId || !guildId) return

        const service = new LevelService(ctx)
        const info = await service.getUserLevel(userId, guildId)
        const username = event.extra?.author?.username ?? `用户${userId}`
        const pct = Math.floor(info.progress * 100)
        const filled = Math.floor(pct / 10)
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)

        const card = {
          type: 'card', theme: 'info', size: 'lg',
          modules: [
            { type: 'header', text: { type: 'plain-text', content: '⭐ 等级信息' } },
            { type: 'divider' },
            {
              type: 'section',
              text: {
                type: 'kmarkdown',
                content: [
                  `**${username}** 的等级信息`,
                  ``,
                  `**等级：** Lv.${info.level}`,
                  `**经验：** ${info.totalXp} / ${info.nextLevelXp} XP`,
                  `**进度：** ${bar} ${pct}%`,
                  `**消息数：** ${info.messageCount}`,
                ].join('\n'),
              },
            },
          ],
        }
        await ctx.kookApi.sendCardMessage(channelId, [card])
      },
    },
  ]
}
