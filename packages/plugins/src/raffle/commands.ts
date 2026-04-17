import type { CommandDefinition, KookMessageEvent, PluginContext } from '@kook-saas/shared'
import { RaffleService } from './service.js'

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: 'raffle',
      aliases: ['抽奖'],
      description: '抽奖管理：create/list/join/draw',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const guildId = event.extra?.guild_id
        const channelId = event.target_id
        const userId = event.author_id
        if (!guildId || !channelId || !userId) return

        const service = new RaffleService(ctx)
        const action = (args[0] || '').toLowerCase()

        if (action === 'create' || action === '创建') {
          const raw = args.slice(1).join(' ')
          const [title, prize, drawAtText] = raw.split('|').map((s) => s?.trim())
          if (!title || !prize || !drawAtText) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /raffle create <标题>|<奖品>|<开奖时间>')
            return
          }
          const drawAt = new Date(drawAtText)
          if (Number.isNaN(drawAt.getTime())) {
            await ctx.kookApi.sendChannelMessage(channelId, '开奖时间格式错误')
            return
          }
          const id = await service.createRaffle({ guildId, channelId, title, prize, drawAt, createdBy: userId })
          await ctx.kookApi.sendChannelMessage(channelId, `抽奖已创建，ID: ${id}`)
          return
        }

        if (action === 'list' || action === '列表') {
          const { rows } = await service.listRaffles(guildId)
          if (!rows.length) {
            await ctx.kookApi.sendChannelMessage(channelId, '暂无抽奖')
            return
          }
          const lines = rows.slice(0, 10).map((item: any) => `#${item.id} [${item.status}] ${item.title} - ${item.prize}`).join('\n')
          await ctx.kookApi.sendChannelMessage(channelId, `抽奖列表:\n${lines}`)
          return
        }

        if (action === 'join' || action === '参与') {
          const id = Number(args[1])
          if (!id) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /raffle join <ID>')
            return
          }
          const result = await service.joinRaffle(id, guildId, userId)
          await ctx.kookApi.sendChannelMessage(channelId, result.message)
          return
        }

        if (action === 'draw' || action === '开奖') {
          const id = Number(args[1])
          if (!id) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /raffle draw <ID>')
            return
          }
          const result = await service.drawWinner(id)
          if ((result as any).success && (result as any).winnerUserId) {
            await ctx.kookApi.sendChannelMessage(channelId, `开奖完成：<@${(result as any).winnerUserId}> 获得 ${(result as any).prize}`)
          } else {
            await ctx.kookApi.sendChannelMessage(channelId, (result as any).message || '开奖失败')
          }
          return
        }

        await ctx.kookApi.sendChannelMessage(channelId, '用法: /raffle create|list|join|draw')
      },
    },
  ]
}
