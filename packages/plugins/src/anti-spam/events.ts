import type { EventHandlerDefinition, KookEvent, PluginContext } from '@kook-saas/shared'
import { AntiSpamService } from './service.js'

export function getEventHandlers(): EventHandlerDefinition[] {
  return [
    {
      eventType: 'message',
      priority: -9,
      handler: async (event: KookEvent, ctx: PluginContext): Promise<boolean> => {
        const service = ctx.getPluginService<AntiSpamService>('anti-spam')
        if (!service) return false

        const result = await service.handleMessage(event)
        return result.blocked === true
      },
    },
  ]
}
