import type { CommandDefinition, KookMessageEvent, PluginContext } from '@kook-saas/shared'
import { AntiSpamService } from './service.js'

function parseBool(text: string | undefined, fallback: boolean): boolean {
  if (!text) return fallback
  const normalized = text.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', '开启', '是'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', '关闭', '否'].includes(normalized)) return false
  return fallback
}

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: 'antispam',
      aliases: ['防刷屏'],
      description: '防刷屏管理：status/set/white/list',
      permission: 'admin',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const guildId = event.extra?.guild_id
        const channelId = event.target_id
        const userId = event.author_id
        if (!guildId || !channelId || !userId) return

        const service = new AntiSpamService(ctx)
        const action = (args[0] || '').toLowerCase()

        if (action === 'status' || action === '状态' || !action) {
          const rule = await service.getRule(guildId)
          await ctx.kookApi.sendChannelMessage(
            channelId,
            `防刷屏状态: ${rule.enabled ? '开启' : '关闭'}\n动作: ${rule.actionType}\n窗口: ${rule.windowSeconds}s/${rule.maxMessagesPerWindow}条\n重复阈值: ${rule.duplicateThreshold}\n拦截@全体: ${rule.blockAtAll ? '是' : '否'}\n禁言时长: ${rule.muteHours}h`,
          )
          return
        }

        if (action === 'set' || action === '设置') {
          const key = String(args[1] || '').trim().toLowerCase()
          const value = String(args[2] || '').trim()
          if (!key) {
            await ctx.kookApi.sendChannelMessage(channelId, '用法: /antispam set <enabled|action|max|window|duplicate|blockall|mutehours> <值>')
            return
          }

          const current = await service.getRule(guildId)
          const patch: any = {}

          if (key === 'enabled') {
            patch.enabled = parseBool(value, current.enabled)
          } else if (key === 'action') {
            if (!['warn', 'mute', 'delete'].includes(value)) {
              await ctx.kookApi.sendChannelMessage(channelId, 'action 仅支持 warn/mute/delete')
              return
            }
            patch.actionType = value
          } else if (key === 'max') {
            patch.maxMessagesPerWindow = Math.max(2, Number(value) || current.maxMessagesPerWindow)
          } else if (key === 'window') {
            patch.windowSeconds = Math.max(3, Number(value) || current.windowSeconds)
          } else if (key === 'duplicate') {
            patch.duplicateThreshold = Math.max(2, Number(value) || current.duplicateThreshold)
          } else if (key === 'blockall') {
            patch.blockAtAll = parseBool(value, current.blockAtAll)
          } else if (key === 'mutehours') {
            patch.muteHours = Math.max(1, Number(value) || current.muteHours)
          } else {
            await ctx.kookApi.sendChannelMessage(channelId, '未知配置项，支持: enabled/action/max/window/duplicate/blockall/mutehours')
            return
          }

          const next = await service.updateRule(guildId, patch)
          await ctx.kookApi.sendChannelMessage(channelId, `已更新防刷屏配置: ${JSON.stringify(next)}`)
          return
        }

        if (action === 'white' || action === '白名单') {
          const sub = (args[1] || '').toLowerCase()
          const targetUserId = String(args[2] || '').trim()

          if (sub === 'add' || sub === '添加') {
            if (!targetUserId) {
              await ctx.kookApi.sendChannelMessage(channelId, '用法: /antispam white add <用户ID>')
              return
            }
            await service.addWhitelist(guildId, targetUserId)
            await ctx.kookApi.sendChannelMessage(channelId, `已加入白名单: ${targetUserId}`)
            return
          }

          if (sub === 'remove' || sub === '删除') {
            if (!targetUserId) {
              await ctx.kookApi.sendChannelMessage(channelId, '用法: /antispam white remove <用户ID>')
              return
            }
            const affected = await service.removeWhitelist(guildId, targetUserId)
            await ctx.kookApi.sendChannelMessage(channelId, affected > 0 ? `已移出白名单: ${targetUserId}` : `白名单中不存在用户: ${targetUserId}`)
            return
          }

          if (sub === 'list' || sub === '列表' || !sub) {
            const rows = await service.listWhitelist(guildId)
            if (!rows.length) {
              await ctx.kookApi.sendChannelMessage(channelId, '白名单为空')
              return
            }
            const lines = rows.slice(0, 50).map((row: any) => row.userId).join('\n')
            await ctx.kookApi.sendChannelMessage(channelId, `白名单用户:\n${lines}`)
            return
          }

          await ctx.kookApi.sendChannelMessage(channelId, '用法: /antispam white add|remove|list')
          return
        }

        if (action === 'list' || action === '记录') {
          const data = await service.listViolations(guildId, 1, 10)
          if (!data.rows.length) {
            await ctx.kookApi.sendChannelMessage(channelId, '暂无违规记录')
            return
          }
          const lines = data.rows.map((row: any) => `${new Date(row.createdAt).toLocaleString('zh-CN')} ${row.userId} ${row.type} ${row.actionTaken}`).join('\n')
          await ctx.kookApi.sendChannelMessage(channelId, `最近违规记录:\n${lines}`)
          return
        }

        await ctx.kookApi.sendChannelMessage(channelId, '用法: /antispam status|set|white|list')
      },
    },
  ]
}
