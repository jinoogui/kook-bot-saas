import type { CommandDefinition, KookMessageEvent, PluginContext } from '@kook-saas/shared'
import { TicketService } from './service.js'

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: 'ticket',
      aliases: ['工单'],
      description: '工单系统：open/list/close/assign',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const guildId = event.extra?.guild_id
        const channelId = event.target_id
        const userId = event.author_id
        if (!guildId || !channelId || !userId) return

        const service = new TicketService(ctx)
        const action = (args[0] || '').toLowerCase()

        if (action === 'open' || action === '创建') {
          const raw = args.slice(1).join(' ')
          const [title, content] = raw.split('|')
          if (!title) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /ticket open <标题>|<内容>')
            return
          }
          const id = await service.createTicket({ guildId, channelId, creatorUserId: userId, title: title.trim(), content: content?.trim() })
          await ctx.kookApi.sendChannelMessage(channelId, `工单已创建，ID: ${id}`)
          return
        }

        if (action === 'list' || action === '列表') {
          const status = args[1]
          const { rows } = await service.listTickets(guildId, { status })
          if (!rows.length) {
            await ctx.kookApi.sendChannelMessage(channelId, '暂无工单')
            return
          }
          const lines = rows.slice(0, 10).map((item: any) => `#${item.id} [${item.status}] ${item.title}`).join('\n')
          await ctx.kookApi.sendChannelMessage(channelId, `工单列表:\n${lines}`)
          return
        }

        if (action === 'close' || action === '关闭') {
          const id = Number(args[1])
          if (!id) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /ticket close <ID>')
            return
          }
          const result = await service.closeTicket(id, userId, args.slice(2).join(' '))
          await ctx.kookApi.sendChannelMessage(channelId, result.affected > 0 ? `工单 ${id} 已关闭` : result.message)
          return
        }

        if (action === 'assign' || action === '受理') {
          const id = Number(args[1])
          const assignee = args[2]
          if (!id || !assignee) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /ticket assign <ID> <用户ID>')
            return
          }
          const result = await service.assignTicket(id, assignee, userId)
          await ctx.kookApi.sendChannelMessage(channelId, result.affected > 0 ? `工单 ${id} 已指派给 ${assignee}` : result.message)
          return
        }

        await ctx.kookApi.sendChannelMessage(channelId, '用法: /ticket open|list|close|assign')
      },
    },
  ]
}
