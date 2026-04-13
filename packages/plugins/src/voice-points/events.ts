import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import { VoicePointsService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'joined_channel',
      priority: 0,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        const body = event.extra?.body
        if (!body) return false
        const userId = body.user_id as string
        const guildId = event.extra?.guild_id ?? (body.guild_id as string)
        const channelId = body.channel_id as string
        if (!userId || !guildId || !channelId) return false
        const service = new VoicePointsService(ctx)
        await service.onUserJoin(userId, guildId, channelId)
        return false
      },
    },
    {
      eventType: 'exited_channel',
      priority: 0,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        const body = event.extra?.body
        if (!body) return false
        const userId = body.user_id as string
        const guildId = event.extra?.guild_id ?? (body.guild_id as string)
        const channelId = body.channel_id as string
        if (!userId || !guildId || !channelId) return false
        const service = new VoicePointsService(ctx)
        await service.onUserLeave(userId, guildId, channelId)
        return false
      },
    },
  ]
}
