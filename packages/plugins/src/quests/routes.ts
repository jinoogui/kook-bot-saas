import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { QuestsService } from './service.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/templates/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const service = new QuestsService(ctx)
        const data = await service.listTemplates(guildId)
        reply.send({ success: true, data })
      },
    },
    {
      method: 'POST',
      path: '/templates/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const body = request.body as any
        if (!body?.code || !body?.title) {
          reply.code(400).send({ success: false, error: '缺少 code/title' })
          return
        }
        const service = new QuestsService(ctx)
        const id = await service.createTemplate({
          guildId,
          code: body.code,
          title: body.title,
          description: body.description,
          targetCount: Number(body.targetCount ?? 10),
          rewardPoints: Number(body.rewardPoints ?? 10),
          enabled: body.enabled !== false,
        })
        reply.send({ success: true, data: { id } })
      },
    },
    {
      method: 'PATCH',
      path: '/templates/:id/enabled',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        const { enabled } = request.body as any
        if (!id || enabled === undefined) {
          reply.code(400).send({ success: false, error: '缺少参数' })
          return
        }
        const service = new QuestsService(ctx)
        const affected = await service.setTemplateEnabled(id, !!enabled)
        reply.send({ success: true, data: { affected } })
      },
    },
    {
      method: 'GET',
      path: '/progress/:guildId/:userId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId, userId } = request.params as { guildId: string; userId: string }
        const dateKey = (request.query as any)?.dateKey as string | undefined
        const service = new QuestsService(ctx)
        const data = await service.getUserProgress(guildId, userId, dateKey)
        reply.send({ success: true, data })
      },
    },
    {
      method: 'POST',
      path: '/progress/:guildId/:userId/:questCode/increment',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId, userId, questCode } = request.params as { guildId: string; userId: string; questCode: string }
        const { amount = 1, dateKey } = request.body as any
        const service = new QuestsService(ctx)
        const data = await service.incrementProgress({ guildId, userId, questCode, amount: Number(amount) || 1, dateKey })
        reply.send({ success: true, data })
      },
    },
    {
      method: 'POST',
      path: '/progress/:guildId/:userId/:questCode/claim',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId, userId, questCode } = request.params as { guildId: string; userId: string; questCode: string }
        const { dateKey } = request.body as any
        const service = new QuestsService(ctx)
        const data = await service.claimReward(guildId, userId, questCode, dateKey)
        reply.send({ success: true, data })
      },
    },
    {
      method: 'GET',
      path: '/leaderboard/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const dateKey = (request.query as any)?.dateKey as string | undefined
        const limit = parseInt((request.query as any)?.limit ?? '20', 10) || 20
        const service = new QuestsService(ctx)
        const data = await service.getLeaderboard(guildId, dateKey, limit)
        reply.send({ success: true, data })
      },
    },
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
        const body = request.body as any
        for (const key of ['enabled', 'auto_claim', 'daily_reset_hour', 'message_quest_code']) {
          if (body?.[key] !== undefined) {
            await ctx.setConfig(key, body[key])
          }
        }
        reply.send({ success: true })
      },
    },
  ]
}
