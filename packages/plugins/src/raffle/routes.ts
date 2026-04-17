import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { RaffleService } from './service.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/items/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const { status, page = '1', size = '20' } = request.query as any
        const service = new RaffleService(ctx)
        const data = await service.listRaffles(guildId, {
          status: status || undefined,
          page: parseInt(page, 10) || 1,
          size: parseInt(size, 10) || 20,
        })
        reply.send({ success: true, data })
      },
    },
    {
      method: 'POST',
      path: '/items/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const body = request.body as any
        if (!body?.title || !body?.prize || !body?.drawAt || !body?.channelId || !body?.createdBy) {
          reply.code(400).send({ success: false, error: '缺少必要参数' })
          return
        }
        const drawAt = new Date(body.drawAt)
        if (Number.isNaN(drawAt.getTime())) {
          reply.code(400).send({ success: false, error: '开奖时间格式错误' })
          return
        }
        const service = new RaffleService(ctx)
        const id = await service.createRaffle({
          guildId,
          channelId: body.channelId,
          title: body.title,
          prize: body.prize,
          drawAt,
          createdBy: body.createdBy,
        })
        reply.send({ success: true, data: { id } })
      },
    },
    {
      method: 'POST',
      path: '/items/:id/join',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        const { guildId, userId } = request.body as any
        if (!id || !guildId || !userId) {
          reply.code(400).send({ success: false, error: '缺少参数' })
          return
        }
        const service = new RaffleService(ctx)
        const result = await service.joinRaffle(id, guildId, userId)
        reply.send({ success: true, data: result })
      },
    },
    {
      method: 'GET',
      path: '/items/:id/participants',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        if (!id) {
          reply.code(400).send({ success: false, error: '无效抽奖ID' })
          return
        }
        const service = new RaffleService(ctx)
        const rows = await service.listParticipants(id)
        reply.send({ success: true, data: rows })
      },
    },
    {
      method: 'POST',
      path: '/items/:id/draw',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        if (!id) {
          reply.code(400).send({ success: false, error: '无效抽奖ID' })
          return
        }
        const service = new RaffleService(ctx)
        const data = await service.drawWinner(id)
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
        for (const key of ['default_duration_minutes', 'prevent_repeat_join']) {
          if (body?.[key] !== undefined) {
            await ctx.setConfig(key, body[key])
          }
        }
        reply.send({ success: true })
      },
    },
  ]
}
