import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import { EventsService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'message_btn_click',
      priority: 0,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        const body = event.extra?.body
        const value = body?.value as string | undefined
        if (!value || !value.startsWith('event:')) return false

        const userId = String(body?.user_id || event.author_id || '')
        const guildId = String(body?.guild_id || event.extra?.guild_id || '')
        if (!userId || !guildId) return false

        const [, action, rawId] = value.split(':')
        const eventId = Number(rawId)
        if (!eventId) return false

        const service = new EventsService(ctx)
        if (action === 'join') {
          await service.joinEvent(eventId, guildId, userId)
          return true
        }
        if (action === 'cancel') {
          await service.cancelJoin(eventId, guildId, userId)
          return true
        }

        return false
      },
    },
  ]
}
