import type { CommandDefinition, KookMessageEvent, PluginContext } from '@kook-saas/shared'
import { parseTimeString } from '@kook-saas/shared'
import { PollsService } from './service.js'

function renderResultLines(result: any): string {
  if (!result?.options?.length) return '暂无投票数据'
  return result.options
    .map((item: any) => `${item.key} ${item.label}：${item.count} 票`)
    .join('\n')
}

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: 'poll',
      aliases: ['投票'],
      description: '投票管理：create/list/vote/result/close',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const guildId = event.extra?.guild_id
        const channelId = event.target_id
        const userId = event.author_id
        if (!guildId || !channelId || !userId) return

        const service = new PollsService(ctx)
        const action = (args[0] || '').toLowerCase()

        if (action === 'create' || action === '创建') {
          const raw = args.slice(1).join(' ')
          const parts = raw.split('|').map((item) => item.trim()).filter(Boolean)
          if (parts.length < 3) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /poll create <标题>|<选项1>|<选项2>|...|<结束时间可选>')
            return
          }

          const title = parts[0]
          let endsAt: Date | null = null
          const options = [...parts.slice(1)]
          const maybeTime = options[options.length - 1]
          if (maybeTime) {
            const parsed = parseTimeString(maybeTime)
            if (parsed) {
              endsAt = parsed
              options.pop()
            }
          }

          if (options.length < 2) {
            await ctx.kookApi.sendChannelMessage(channelId, '至少提供两个选项')
            return
          }

          const id = await service.createPoll({
            guildId,
            channelId,
            title,
            options,
            endsAt,
            createdBy: userId,
          })
          await ctx.kookApi.sendChannelMessage(channelId, `投票已创建，ID: ${id}`)
          return
        }

        if (action === 'list' || action === '列表') {
          const { rows } = await service.listPolls(guildId)
          if (!rows.length) {
            await ctx.kookApi.sendChannelMessage(channelId, '暂无投票')
            return
          }
          const lines = rows
            .slice(0, 10)
            .map((item: any) => `#${item.id} [${item.status}] ${item.title}`)
            .join('\n')
          await ctx.kookApi.sendChannelMessage(channelId, `投票列表:\n${lines}`)
          return
        }

        if (action === 'vote' || action === '投票') {
          const id = Number(args[1])
          const optionText = args.slice(2).join(' ').trim()
          if (!id || !optionText) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /poll vote <ID> <opt1,opt2>')
            return
          }
          const optionKeys = optionText.split(',').map((item) => item.trim()).filter(Boolean)
          const result = await service.vote(id, guildId, userId, optionKeys)
          await ctx.kookApi.sendChannelMessage(channelId, result.message)
          return
        }

        if (action === 'result' || action === '结果') {
          const id = Number(args[1])
          if (!id) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /poll result <ID>')
            return
          }
          const result = await service.getResults(id)
          if (!result) {
            await ctx.kookApi.sendChannelMessage(channelId, '投票不存在')
            return
          }
          await ctx.kookApi.sendChannelMessage(
            channelId,
            `投票「${result.poll.title}」结果：\n${renderResultLines(result)}\n总票数：${result.totalVotes}`,
          )
          return
        }

        if (action === 'close' || action === '关闭') {
          const id = Number(args[1])
          if (!id) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /poll close <ID>')
            return
          }
          const affected = await service.closePoll(id)
          await ctx.kookApi.sendChannelMessage(channelId, affected > 0 ? `投票 ${id} 已关闭` : `未找到投票 ${id}`)
          return
        }

        await ctx.kookApi.sendChannelMessage(channelId, '用法: /poll create|list|vote|result|close')
      },
    },
  ]
}
