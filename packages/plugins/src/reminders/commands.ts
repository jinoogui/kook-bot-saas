import type { CommandDefinition, KookMessageEvent, PluginContext } from '@kook-saas/shared'
import { parseTimeString } from '@kook-saas/shared'
import { ReminderService } from './service.js'

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: '提醒',
      aliases: ['remind', 'reminder', '倒计时'],
      description: '设置/查看/删除提醒',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const userId = event.author_id ?? event.extra?.author?.id
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!userId || !guildId) return

        const service = new ReminderService(ctx)

        // /提醒 list | 列表
        if (args[0] === 'list' || args[0] === '列表') {
          const list = await service.getUserReminders(userId, guildId)
          if (!list.length) {
            await ctx.kookApi.sendChannelMessage(channelId, '你没有待发送的提醒')
            return
          }
          const lines = list.map((r: any) =>
            `**ID:${r.id}**  ${new Date(r.remindAt).toLocaleString('zh-CN')}  —  ${r.content}`,
          ).join('\n')
          const card = {
            type: 'card',
            theme: 'info',
            size: 'lg',
            modules: [
              { type: 'header', text: { type: 'plain-text', content: '我的提醒' } },
              { type: 'section', text: { type: 'kmarkdown', content: lines } },
              { type: 'section', text: { type: 'kmarkdown', content: '使用 `/提醒 del <ID>` 删除提醒' } },
            ],
          }
          await ctx.kookApi.sendCardMessage(channelId, [card])
          return
        }

        // /提醒 del <id> | 删除 <id>
        if ((args[0] === 'del' || args[0] === '删除') && args[1]) {
          const id = parseInt(args[1])
          if (isNaN(id)) {
            await ctx.kookApi.sendChannelMessage(channelId, '请输入正确的提醒 ID')
            return
          }
          const ok = await service.deleteReminder(id, userId)
          await ctx.kookApi.sendChannelMessage(channelId, ok ? '提醒已删除' : '未找到该提醒')
          return
        }

        // /提醒 <时间> <内容>
        if (args.length < 2) {
          await ctx.kookApi.sendChannelMessage(
            channelId,
            '用法：`/提醒 <时间> <内容>`\n例如：`/提醒 30分钟 记得开会`\n\n时间格式：`30分钟` `2小时` `3天` `18:30` `2024-12-21 20:00`',
          )
          return
        }

        const timeStr = args[0]
        const content = args.slice(1).join(' ')
        const remindAt = parseTimeString(timeStr)

        if (!remindAt) {
          await ctx.kookApi.sendChannelMessage(channelId, `无法解析时间格式：${timeStr}`)
          return
        }

        if (remindAt.getTime() <= Date.now()) {
          await ctx.kookApi.sendChannelMessage(channelId, '提醒时间不能是过去的时间')
          return
        }

        const id = await service.addReminder(userId, guildId, channelId, content, remindAt)
        const card = {
          type: 'card',
          theme: 'success',
          size: 'lg',
          modules: [
            { type: 'header', text: { type: 'plain-text', content: '提醒已设置' } },
            {
              type: 'section',
              text: {
                type: 'kmarkdown',
                content: `**内容：** ${content}\n**时间：** ${remindAt.toLocaleString('zh-CN')}\n**ID：** ${id}`,
              },
            },
          ],
        }
        await ctx.kookApi.sendCardMessage(channelId, [card])
      },
    },
  ]
}
