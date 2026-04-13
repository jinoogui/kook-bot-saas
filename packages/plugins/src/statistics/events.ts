import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import { StatisticsService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'message',
      priority: 10, // post-process, after all other handlers
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        if (event.extra?.author?.bot) return false
        const userId = event.author_id
        const guildId = event.extra?.guild_id
        if (!userId || !guildId) return false

        const service = new StatisticsService(ctx)
        await service.trackMessage(userId, guildId)
        return false
      },
    },
  ]
}
