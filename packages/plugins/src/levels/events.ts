import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'message',
      priority: 5,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        if (event.extra?.author?.bot) return false

        const userId = event.author_id
        const guildId = event.extra?.guild_id
        const channelId = event.target_id
        const username = event.extra?.author?.username ?? `用户${userId}`

        if (!userId || !guildId) return false

        const service = ctx.getPluginService<{ onMessage: (userId: string, guildId: string, channelId: string, username: string) => Promise<void> }>('levels')
        if (!service) return false
        await service.onMessage(userId, guildId, channelId, username)
        return false
      },
    },
  ]
}
