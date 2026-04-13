import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import { WelcomeService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'joined_guild',
      priority: 0,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        const body = event.extra?.body
        if (!body) return false

        const userId = body.user_id as string
        const guildId = event.extra?.guild_id ?? (body.guild_id as string)
        const username = (body.username as string) ?? `用户${userId}`

        if (!userId || !guildId) return false

        const service = new WelcomeService(ctx)
        await service.onUserJoin(userId, guildId, username)
        return false
      },
    },
    {
      eventType: 'exited_guild',
      priority: 0,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        const body = event.extra?.body
        if (!body) return false

        const userId = body.user_id as string
        const guildId = event.extra?.guild_id ?? (body.guild_id as string)
        const username = (body.username as string) ?? `用户${userId}`

        if (!userId || !guildId) return false

        const service = new WelcomeService(ctx)
        await service.onUserLeave(userId, guildId, username)
        return false
      },
    },
  ]
}
