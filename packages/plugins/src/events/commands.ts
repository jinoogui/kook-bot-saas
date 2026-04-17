import type { CommandDefinition, KookMessageEvent, PluginContext } from '@kook-saas/shared'
import { EventsService } from './service.js'

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: 'event',
      aliases: ['活动'],
      description: '活动管理：create/list/join/cancel/close',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const guildId = event.extra?.guild_id
        const channelId = event.target_id
        const userId = event.author_id
        if (!guildId || !channelId || !userId) return

        const service = new EventsService(ctx)
        const action = (args[0] || '').toLowerCase()

        if (action === 'create' || action === '创建') {
          const raw = args.slice(1).join(' ')
          const [title, startAtText, endAtText, maxText] = raw.split('|').map((item) => item?.trim())
          if (!title || !startAtText || !endAtText) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /event create <标题>|<开始时间>|<结束时间>|<人数上限可选>')
            return
          }
          const startAt = new Date(startAtText)
          const endAt = new Date(endAtText)
          if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
            await ctx.kookApi.sendChannelMessage(channelId, '时间格式无效或结束时间早于开始时间')
            return
          }
          const id = await service.createEvent({
            guildId,
            channelId,
            title,
            startAt,
            endAt,
            maxParticipants: maxText ? Number(maxText) || 0 : 0,
            createdBy: userId,
          })
          await ctx.kookApi.sendChannelMessage(channelId, `活动已创建，ID: ${id}`)
          return
        }

        if (action === 'list' || action === '列表') {
          const { rows } = await service.listEvents(guildId)
          if (!rows.length) {
            await ctx.kookApi.sendChannelMessage(channelId, '暂无活动')
            return
          }
          const lines = rows.slice(0, 10).map((item: any) => `#${item.id} [${item.status}] ${item.title}`).join('\n')
          await ctx.kookApi.sendChannelMessage(channelId, `活动列表:\n${lines}`)
          return
        }

        if (action === 'join' || action === '报名') {
          const id = Number(args[1])
          if (!id) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /event join <活动ID>')
            return
          }
          const result = await service.joinEvent(id, guildId, userId)
          await ctx.kookApi.sendChannelMessage(channelId, result.message)
          return
        }

        if (action === 'cancel' || action === '取消') {
          const id = Number(args[1])
          if (!id) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /event cancel <活动ID>')
            return
          }
          const ok = await service.cancelJoin(id, guildId, userId)
          await ctx.kookApi.sendChannelMessage(channelId, ok ? '已取消报名' : '未找到报名记录')
          return
        }

        if (action === 'close' || action === '关闭') {
          const id = Number(args[1])
          if (!id) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /event close <活动ID>')
            return
          }
          const affected = await service.closeEvent(id)
          await ctx.kookApi.sendChannelMessage(channelId, affected > 0 ? `活动 ${id} 已关闭` : `未找到活动 ${id}`)
          return
        }

        await ctx.kookApi.sendChannelMessage(channelId, '用法: /event create|list|join|cancel|close')
      },
    },
  ]
}
