import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { WelcomeService } from './service.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/config/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const service = new WelcomeService(ctx)
        const config = await service.getConfig(guildId)
        reply.send({ success: true, data: config })
      },
    },
    {
      method: 'POST',
      path: '/config/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const body = request.body as {
          content?: string
          channelId?: string
          enabled?: number
          messageType?: string
          cardContent?: string
        }

        const service = new WelcomeService(ctx)
        await service.updateConfig(guildId, {
          content: body.content,
          channelId: body.channelId,
          enabled: body.enabled,
          messageType: body.messageType,
          cardContent: body.cardContent,
        })

        reply.send({ success: true })
      },
    },
  ]
}
