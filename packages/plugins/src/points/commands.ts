import type { CommandDefinition, KookMessageEvent, PluginContext } from '@kook-saas/shared'
import { PointsService } from './service.js'
import type { CheckinResult } from './service.js'

function buildCheckinCard(result: CheckinResult, username: string): object {
  if (result.alreadyCheckin) {
    return {
      type: 'card',
      theme: 'warning',
      size: 'lg',
      modules: [
        { type: 'header', text: { type: 'plain-text', content: '签到提醒' } },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'kmarkdown',
            content: `**${username}**，你今天已经签到过了！\n\n**连续签到：** ${result.streak} 天\n**当前积分：** ${result.currentPoints} 分\n\n明天再来签到吧~`,
          },
        },
      ],
    }
  }

  const bonusLine = result.bonusPoints && result.bonusPoints > 0
    ? `\n**连签奖励：** +${result.bonusPoints} 分（连续 ${result.streak} 天）`
    : ''

  return {
    type: 'card',
    theme: 'success',
    size: 'lg',
    modules: [
      { type: 'header', text: { type: 'plain-text', content: '签到成功' } },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: [
            `**${username}** 签到成功！`,
            ``,
            `**基础积分：** +${result.basePoints} 分${bonusLine}`,
            `**本次获得：** +${result.totalPoints} 分`,
            `**当前积分：** ${result.currentPoints} 分`,
            `**连续签到：** ${result.streak} 天`,
          ].join('\n'),
        },
      },
    ],
  }
}

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: '签到',
      aliases: ['checkin', '打卡', 'qiandao'],
      description: '每日签到获取积分',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, _args: string[], ctx: PluginContext): Promise<void> => {
        const userId = event.author_id ?? event.extra?.author?.id
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!userId || !guildId) return

        const service = new PointsService(ctx)
        const result = await service.doCheckin(userId, guildId)
        const username = event.extra?.author?.username ?? `用户${userId}`
        const card = buildCheckinCard(result, username)
        await ctx.kookApi.sendCardMessage(channelId, [card])
      },
    },
    {
      name: '积分',
      aliases: ['points', 'point', '我的积分', 'jifen', '积分查询'],
      description: '查看当前积分',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, _args: string[], ctx: PluginContext): Promise<void> => {
        const userId = event.author_id ?? event.extra?.author?.id
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!userId || !guildId) return

        const service = new PointsService(ctx)
        const points = await service.getUserPoints(userId, guildId)
        const history = await service.getCheckinHistory(userId, guildId, 7)
        const streak = await service.getConsecutiveDays(userId, guildId)
        const username = event.extra?.author?.username ?? `用户${userId}`

        const historyLines = history.length
          ? history.map((r: any) => `  ${r.checkinDate}  +${r.points + (r.bonusPoints ?? 0)} 分`).join('\n')
          : '  暂无记录'

        const card = {
          type: 'card',
          theme: 'info',
          size: 'lg',
          modules: [
            { type: 'header', text: { type: 'plain-text', content: '我的积分' } },
            { type: 'divider' },
            {
              type: 'section',
              text: {
                type: 'kmarkdown',
                content: [
                  `**${username}** 的积分信息`,
                  ``,
                  `**当前积分：** ${points} 分`,
                  `**连续签到：** ${streak} 天`,
                  ``,
                  `**近7天签到记录：**`,
                  historyLines,
                ].join('\n'),
              },
            },
          ],
        }
        await ctx.kookApi.sendCardMessage(channelId, [card])
      },
    },
    {
      name: '排行榜',
      aliases: ['rank', 'ranking', '排行', 'phb'],
      description: '积分排行榜',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, _args: string[], ctx: PluginContext): Promise<void> => {
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!guildId) return

        const service = new PointsService(ctx)
        const board = await service.getLeaderboard(guildId, 10)
        if (!board.length) {
          await ctx.kookApi.sendChannelMessage(channelId, '暂无积分数据')
          return
        }

        const medals = ['🥇', '🥈', '🥉']
        const lines = board.map((row: any, i: number) =>
          `${medals[i] ?? `${i + 1}.`} (met)${row.userId}(met)  **${row.points}** 分`,
        )

        const card = {
          type: 'card',
          theme: 'secondary',
          size: 'lg',
          modules: [
            { type: 'header', text: { type: 'plain-text', content: '积分排行榜' } },
            { type: 'divider' },
            { type: 'section', text: { type: 'kmarkdown', content: lines.join('\n') } },
          ],
        }
        await ctx.kookApi.sendCardMessage(channelId, [card])
      },
    },
    {
      name: '商店',
      aliases: ['shop', '积分商店', '积分商城', 'shangcheng', '商城'],
      description: '查看积分商店',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, _args: string[], ctx: PluginContext): Promise<void> => {
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!guildId) return

        const service = new PointsService(ctx)
        const items = await service.getShopItems(guildId)
        if (!items.length) {
          await ctx.kookApi.sendChannelMessage(channelId, '商店暂无商品')
          return
        }

        const lines = items.map((item: any) =>
          `**ID:${item.id}** ${item.name}  —  **${item.price}** 分` +
          (item.description ? `\n  *${item.description}*` : '') +
          (item.stock === -1 ? '' : `  库存：${item.stock}`),
        )

        const card = {
          type: 'card',
          theme: 'secondary',
          size: 'lg',
          modules: [
            { type: 'header', text: { type: 'plain-text', content: '积分商店' } },
            { type: 'divider' },
            { type: 'section', text: { type: 'kmarkdown', content: lines.join('\n\n') } },
            { type: 'divider' },
            { type: 'section', text: { type: 'kmarkdown', content: '使用 `/购买 <ID>` 购买商品' } },
          ],
        }
        await ctx.kookApi.sendCardMessage(channelId, [card])
      },
    },
    {
      name: '购买',
      aliases: ['buy', '兑换', 'duihuan'],
      description: '兑换商品',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const userId = event.author_id ?? event.extra?.author?.id
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!userId || !guildId) return

        const itemId = parseInt(args[0])
        if (isNaN(itemId)) {
          await ctx.kookApi.sendChannelMessage(channelId, '请输入正确的商品 ID，例如：`/购买 1`')
          return
        }

        const service = new PointsService(ctx)
        const result = await service.buyShopItem(userId, guildId, itemId)
        if (!result.success) {
          await ctx.kookApi.sendChannelMessage(channelId, result.message)
          return
        }

        const card = {
          type: 'card',
          theme: 'success',
          size: 'lg',
          modules: [
            { type: 'header', text: { type: 'plain-text', content: '兑换成功' } },
            {
              type: 'section',
              text: {
                type: 'kmarkdown',
                content: `成功兑换 **${result.item!.name}**！\n消耗 **${result.item!.price}** 积分`,
              },
            },
          ],
        }
        await ctx.kookApi.sendCardMessage(channelId, [card])
      },
    },
    {
      name: '宝箱',
      aliases: ['box', '开箱'],
      description: '开启积分宝箱',
      permission: 'everyone',
      handler: async (event: KookMessageEvent, _args: string[], ctx: PluginContext): Promise<void> => {
        const userId = event.author_id ?? event.extra?.author?.id
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!userId || !guildId) return

        const service = new PointsService(ctx)
        const result = await service.openBox(userId, guildId)
        if (!result.success) {
          await ctx.kookApi.sendChannelMessage(channelId, result.message)
          return
        }

        const card = {
          type: 'card',
          theme: 'success',
          size: 'lg',
          modules: [
            { type: 'header', text: { type: 'plain-text', content: '神秘宝箱' } },
            {
              type: 'section',
              text: {
                type: 'kmarkdown',
                content: `恭喜！你从宝箱中获得了 **${result.reward}** 积分！`,
              },
            },
          ],
        }
        await ctx.kookApi.sendCardMessage(channelId, [card])
      },
    },
  ]
}
