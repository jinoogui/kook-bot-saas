import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import type { FilterService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'message',
      priority: -10,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        if (event.type !== 1 && event.type !== 9) return false
        const content = event.content
        if (!content) return false
        const guildId = event.extra?.guild_id
        if (!guildId) return false
        const userId = event.author_id
        const channelId = event.target_id
        const msgId = event.msg_id
        if (event.extra?.author?.bot) return false

        const service = ctx.getPluginService<FilterService>('content-filter')
        if (!service) return false

        const result = await service.check(content, guildId, userId, channelId)

        if (result.isViolation) {
          try {
            await ctx.kookApi.deleteMessage(msgId)
            ctx.logger.info(
              `已删除违规消息: user=${userId} guild=${guildId} type=${result.type} reason=${result.reason}`,
            )
          } catch (err) {
            ctx.logger.error('删除违规消息失败:', err)
          }
          await service.recordViolation(userId, guildId, result.type, content, channelId)
          return true
        }

        return false
      },
    },
  ]
}
