import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import { PollsService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'message_btn_click',
      priority: 0,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        const body = event.extra?.body
        const value = body?.value as string | undefined
        if (!value || !value.startsWith('poll:vote:')) return false

        const userId = String(body?.user_id || event.author_id || '')
        const guildId = String(body?.guild_id || event.extra?.guild_id || '')
        if (!userId || !guildId) return false

        const [, , rawPollId, rawOptionKey] = value.split(':')
        const pollId = Number(rawPollId)
        if (!pollId || !rawOptionKey) return false

        const service = new PollsService(ctx)
        await service.vote(pollId, guildId, userId, [rawOptionKey])
        return true
      },
    },
  ]
}
