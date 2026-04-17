import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import { RaffleService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'message_btn_click',
      priority: 0,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        const body = event.extra?.body
        const value = body?.value as string | undefined
        if (!value || !value.startsWith('raffle:')) return false

        const userId = String(body?.user_id || event.author_id || '')
        const guildId = String(body?.guild_id || event.extra?.guild_id || '')
        if (!userId || !guildId) return false

        const [, action, rawId] = value.split(':')
        const raffleId = Number(rawId)
        if (!raffleId) return false

        const service = new RaffleService(ctx)
        if (action === 'join') {
          await service.joinRaffle(raffleId, guildId, userId)
          return true
        }

        return false
      },
    },
  ]
}
