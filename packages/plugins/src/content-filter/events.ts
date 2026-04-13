import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import { FilterService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  // Cache FilterService per PluginContext to avoid re-initializing on every event
  const serviceCache = new WeakMap<PluginContext, FilterService>()

  async function getOrCreateService(ctx: PluginContext): Promise<FilterService> {
    let service = serviceCache.get(ctx)
    if (!service) {
      service = new FilterService(ctx)
      await service.init()
      serviceCache.set(ctx, service)
    }
    return service
  }

  return [
    {
      eventType: 'message',
      priority: -10,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        // 只处理频道文本消息 (type 1=text, 9=kmarkdown)
        if (event.type !== 1 && event.type !== 9) return false

        const content = event.content
        if (!content) return false

        const guildId = event.extra?.guild_id
        if (!guildId) return false

        const userId = event.author_id
        const channelId = event.target_id
        const msgId = event.msg_id

        // 忽略机器人自身消息
        if (event.extra?.author?.bot) return false

        const service = await getOrCreateService(ctx)
        const result = await service.check(content, guildId, userId, channelId)

        if (result.isViolation) {
          try {
            // 删除违规消息
            await ctx.kookApi.deleteMessage(msgId)
            ctx.logger.info(
              `已删除违规消息: user=${userId} guild=${guildId} type=${result.type} reason=${result.reason}`,
            )
          } catch (err) {
            ctx.logger.error('删除违规消息失败:', err)
          }

          // 记录违规
          await service.recordViolation(
            userId,
            guildId,
            result.type,
            content,
            channelId,
          )

          // 返回 true 表示已处理，阻止后续插件
          return true
        }

        return false
      },
    },
  ]
}
