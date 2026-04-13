import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { PointsService } from './service.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/config',
      auth: true,
      handler: async (_request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const config = await ctx.getConfig()
        reply.send({ success: true, data: config })
      },
    },
    {
      method: 'POST',
      path: '/config',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const body = request.body as Record<string, any>
        const allowedKeys = [
          'checkin_min_points',
          'checkin_max_points',
          'checkin_streak_enabled',
          'checkin_streak_min',
          'checkin_streak_max',
          'box_cost',
          'box_min_reward',
          'box_max_reward',
          'box_cooldown',
        ]
        for (const key of allowedKeys) {
          if (body[key] !== undefined) {
            await ctx.setConfig(key, body[key])
          }
        }
        reply.send({ success: true })
      },
    },
    {
      method: 'GET',
      path: '/leaderboard/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const limit = parseInt((request.query as any)?.limit ?? '10') || 10
        const service = new PointsService(ctx)
        const data = await service.getLeaderboard(guildId, limit)
        reply.send({ success: true, data })
      },
    },
    {
      method: 'GET',
      path: '/user/:guildId/:userId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId, userId } = request.params as { guildId: string; userId: string }
        const service = new PointsService(ctx)
        const points = await service.getUserPoints(userId, guildId)
        const streak = await service.getConsecutiveDays(userId, guildId)
        reply.send({ success: true, data: { userId, guildId, points, streak } })
      },
    },
    {
      method: 'GET',
      path: '/shop/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const service = new PointsService(ctx)
        const items = await service.getShopItems(guildId)
        reply.send({ success: true, data: items })
      },
    },
  ]
}
