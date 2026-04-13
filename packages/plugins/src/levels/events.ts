import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import { LevelService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'message',
      priority: 5, // after normal handlers
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        // Skip bot messages and system messages
        if (event.extra?.author?.bot) return false

        const userId = event.author_id
        const guildId = event.extra?.guild_id
        const channelId = event.target_id
        const username = event.extra?.author?.username ?? `用户${userId}`

        if (!userId || !guildId) return false

        const service = new LevelService(ctx)
        await service.onMessage(userId, guildId, channelId, username)
        return false
      },
    },
  ]
}
