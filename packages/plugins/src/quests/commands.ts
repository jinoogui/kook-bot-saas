import type { CommandDefinition, KookMessageEvent, PluginContext } from '@kook-saas/shared'
import { QuestsService } from './service.js'

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: 'quest',
      aliases: ['任务'],
      description: '任务管理：create/list/progress/claim/rank',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const guildId = event.extra?.guild_id
        const channelId = event.target_id
        const userId = event.author_id
        if (!guildId || !channelId || !userId) return

        const service = new QuestsService(ctx)
        const action = (args[0] || '').toLowerCase()

        if (action === 'create' || action === '创建') {
          const raw = args.slice(1).join(' ')
          const [code, title, targetText, rewardText, description] = raw.split('|').map((item) => item?.trim())
          if (!code || !title) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /quest create <编码>|<标题>|<目标次数可选>|<奖励积分可选>|<描述可选>')
            return
          }
          const id = await service.createTemplate({
            guildId,
            code,
            title,
            targetCount: targetText ? Number(targetText) || 10 : 10,
            rewardPoints: rewardText ? Number(rewardText) || 10 : 10,
            description,
          })
          await ctx.kookApi.sendChannelMessage(channelId, `任务模板已创建，ID: ${id}`)
          return
        }

        if (action === 'list' || action === '列表') {
          const rows = await service.listTemplates(guildId)
          if (!rows.length) {
            await ctx.kookApi.sendChannelMessage(channelId, '暂无任务模板')
            return
          }
          const lines = rows
            .slice(0, 15)
            .map((row: any) => `${row.code} [${row.enabled === 1 ? '启用' : '禁用'}] ${row.title} (${row.targetCount}/${row.rewardPoints}分)`)
            .join('\n')
          await ctx.kookApi.sendChannelMessage(channelId, `任务模板:\n${lines}`)
          return
        }

        if (action === 'progress' || action === '进度' || !action) {
          const list = await service.getUserProgress(guildId, userId)
          if (!list.length) {
            await ctx.kookApi.sendChannelMessage(channelId, '当前没有可用任务')
            return
          }
          const lines = list
            .map((item: any) => `${item.code} ${item.title} ${item.progress}/${item.targetCount} ${item.claimed ? '[已领取]' : item.completed ? '[可领取]' : ''}`)
            .join('\n')
          await ctx.kookApi.sendChannelMessage(channelId, `你的任务进度:\n${lines}`)
          return
        }

        if (action === 'claim' || action === '领取') {
          const code = String(args[1] || '').trim()
          if (!code) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /quest claim <任务编码>')
            return
          }
          const result = await service.claimReward(guildId, userId, code)
          if (!(result as any).success) {
            await ctx.kookApi.sendChannelMessage(channelId, (result as any).message || '领取失败')
            return
          }
          await ctx.kookApi.sendChannelMessage(channelId, `领取成功，获得 ${(result as any).rewardPoints} 积分`)
          return
        }

        if (action === 'rank' || action === '排行') {
          const rows = await service.getLeaderboard(guildId)
          if (!rows.length) {
            await ctx.kookApi.sendChannelMessage(channelId, '暂无排行数据')
            return
          }
          const lines = rows.slice(0, 10).map((item: any, index: number) => `${index + 1}. ${item.userId} (${item.claimedCount})`).join('\n')
          await ctx.kookApi.sendChannelMessage(channelId, `任务领奖排行:\n${lines}`)
          return
        }

        await ctx.kookApi.sendChannelMessage(channelId, '用法: /quest create|list|progress|claim|rank')
      },
    },
  ]
}
