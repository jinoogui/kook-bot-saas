import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { StatisticsService } from './service.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/online/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const days = parseInt((request.query as any)?.days ?? '7')
        const service = new StatisticsService(ctx)
        const history = await service.getOnlineHistory(guildId, days)
        reply.send({ success: true, data: history })
      },
    },
    {
      method: 'GET',
      path: '/ranking/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const limit = parseInt((request.query as any)?.limit ?? '10')
        const service = new StatisticsService(ctx)
        const ranking = await service.getTopUsers(guildId, limit)
        reply.send({ success: true, data: ranking })
      },
    },
  ]
}
