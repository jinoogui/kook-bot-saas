import type { CommandDefinition, KookMessageEvent, PluginContext } from '@kook-saas/shared'
import { parseTimeString } from '@kook-saas/shared'
import { AnnouncerService } from './service.js'

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: 'announce',
      aliases: ['公告'],
      description: '公告管理：create/list/cancel/send',
      permission: 'admin',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const guildId = event.extra?.guild_id
        const channelId = event.target_id
        const userId = event.author_id
        if (!guildId || !channelId || !userId) return

        const service = new AnnouncerService(ctx)
        const action = (args[0] || '').toLowerCase()

        if (action === 'create' || action === '创建') {
          const raw = args.slice(1).join(' ')
          const [title, content, scheduleText] = raw.split('|').map((item) => item?.trim())
          if (!title || !content || !scheduleText) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /announce create <标题>|<内容>|<时间>')
            return
          }

          const scheduleAt = parseTimeString(scheduleText)
          if (!scheduleAt || scheduleAt.getTime() <= Date.now()) {
            await ctx.kookApi.sendChannelMessage(channelId, '时间格式无效或早于当前时间')
            return
          }

          const id = await service.createTask({ guildId, channelId, title, content, scheduleAt, createdBy: userId })
          await ctx.kookApi.sendChannelMessage(channelId, `公告任务已创建，ID: ${id}`)
          return
        }

        if (action === 'list' || action === '列表') {
          const { rows } = await service.listTasks(guildId)
          if (!rows.length) {
            await ctx.kookApi.sendChannelMessage(channelId, '暂无公告任务')
            return
          }
          const lines = rows
            .slice(0, 10)
            .map((item: any) => `#${item.id} [${item.status}] ${item.title} @ ${new Date(item.scheduleAt).toLocaleString('zh-CN')}`)
            .join('\n')
          await ctx.kookApi.sendChannelMessage(channelId, `公告任务列表:\n${lines}`)
          return
        }

        if (action === 'cancel' || action === '取消') {
          const id = Number(args[1])
          if (!id) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /announce cancel <ID>')
            return
          }
          const affected = await service.cancelTask(id)
          await ctx.kookApi.sendChannelMessage(channelId, affected > 0 ? `公告任务 ${id} 已取消` : `未找到公告任务 ${id}`)
          return
        }

        if (action === 'send' || action === '发送') {
          const id = Number(args[1])
          if (!id) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /announce send <ID>')
            return
          }
          const result = await service.sendNow(id)
          await ctx.kookApi.sendChannelMessage(channelId, result.success ? `公告任务 ${id} 已发送` : (result.message || '发送失败'))
          return
        }

        await ctx.kookApi.sendChannelMessage(channelId, '用法: /announce create|list|cancel|send')
      },
    },
  ]
}
