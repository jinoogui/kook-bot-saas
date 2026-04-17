import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import { TicketService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'message_btn_click',
      priority: 0,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        const body = event.extra?.body
        const value = body?.value as string | undefined
        if (!value || !value.startsWith('ticket:')) return false

        const userId = String(body?.user_id || event.author_id || '')
        if (!userId) return false

        const service = new TicketService(ctx)
        const [, action, rawId] = value.split(':')
        const ticketId = Number(rawId)
        if (!ticketId) return false

        if (action === 'close') {
          await service.closeTicket(ticketId, userId, '按钮关闭')
          return true
        }

        if (action === 'assign') {
          await service.assignTicket(ticketId, userId, userId)
          return true
        }

        return false
      },
    },
  ]
}
