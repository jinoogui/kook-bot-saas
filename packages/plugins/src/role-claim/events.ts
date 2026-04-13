import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import { RoleClaimService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'message_btn_click',
      priority: 0,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        const body = event.extra?.body
        if (!body) return false

        const value = body.value as string
        if (!value?.startsWith('role_claim:')) return false

        const userId = body.user_id as string
        const guildId = body.guild_id as string ?? event.extra?.guild_id
        const channelId = body.target_id as string ?? event.target_id
        const msgId = body.msg_id as string ?? event.msg_id
        if (!userId || !guildId) return false

        const service = new RoleClaimService(ctx)
        await service.onButtonClick(userId, guildId, value, channelId, msgId)
        return true // consumed this button click
      },
    },
  ]
}
