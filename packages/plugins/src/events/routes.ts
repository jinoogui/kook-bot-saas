import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { EventsService } from './service.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/items/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const { status, page = '1', size = '20' } = request.query as any
        const service = new EventsService(ctx)
        const data = await service.listEvents(guildId, {
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
        if (!body?.title || !body?.startAt || !body?.endAt || !body?.channelId || !body?.createdBy) {
          reply.code(400).send({ success: false, error: '缺少必要参数' })
          return
        }
        const startAt = new Date(body.startAt)
        const endAt = new Date(body.endAt)
        if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
          reply.code(400).send({ success: false, error: '开始/结束时间不合法' })
          return
        }
        const service = new EventsService(ctx)
        const id = await service.createEvent({
          guildId,
          channelId: body.channelId,
          title: body.title,
          description: body.description,
          startAt,
          endAt,
          maxParticipants: Number(body.maxParticipants ?? 0),
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
        const service = new EventsService(ctx)
        const result = await service.joinEvent(id, guildId, userId)
        reply.send({ success: true, data: result })
      },
    },
    {
      method: 'POST',
      path: '/items/:id/cancel',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        const { guildId, userId } = request.body as any
        if (!id || !guildId || !userId) {
          reply.code(400).send({ success: false, error: '缺少参数' })
          return
        }
        const service = new EventsService(ctx)
        const ok = await service.cancelJoin(id, guildId, userId)
        reply.send({ success: true, data: { ok } })
      },
    },
    {
      method: 'GET',
      path: '/items/:id/participants',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        if (!id) {
          reply.code(400).send({ success: false, error: '无效活动ID' })
          return
        }
        const service = new EventsService(ctx)
        const rows = await service.listParticipants(id)
        reply.send({ success: true, data: rows })
      },
    },
    {
      method: 'POST',
      path: '/items/:id/close',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        if (!id) {
          reply.code(400).send({ success: false, error: '无效活动ID' })
          return
        }
        const service = new EventsService(ctx)
        const affected = await service.closeEvent(id)
        reply.send({ success: true, data: { affected } })
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
        for (const key of ['reminder_before_minutes', 'default_max_participants']) {
          if (body?.[key] !== undefined) {
            await ctx.setConfig(key, body[key])
          }
        }
        reply.send({ success: true })
      },
    },
  ]
}
