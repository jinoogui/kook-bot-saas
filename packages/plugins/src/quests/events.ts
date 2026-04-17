import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import { QuestsService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'message',
      priority: 8,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        if (event.extra?.author?.bot) return false

        const userId = event.author_id
        const guildId = event.extra?.guild_id
        if (!userId || !guildId) return false

        const config = await ctx.getConfig()
        const messageQuestCode = String(config.message_quest_code || '').trim()
        if (!messageQuestCode) return false

        const service = new QuestsService(ctx)
        await service.incrementProgress({
          guildId,
          userId,
          questCode: messageQuestCode,
          amount: 1,
        })

        return false
      },
    },
  ]
}
