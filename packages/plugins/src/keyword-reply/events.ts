import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'message',
      priority: 1,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        if (event.extra?.author?.bot) return false
        const content = event.content
        const guildId = event.extra?.guild_id
        const channelId = event.target_id
        const msgId = event.msg_id
        if (!content || !guildId || !channelId) return false

        const service = ctx.getPluginService<{ check: (content: string, guildId: string, channelId: string, msgId: string) => Promise<boolean> }>('keyword-reply')
        if (!service) return false
        return await service.check(content, guildId, channelId, msgId)
      },
    },
  ]
}
