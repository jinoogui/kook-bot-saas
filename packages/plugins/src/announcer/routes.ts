import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { AnnouncerService } from './service.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/tasks/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const { status, page = '1', size = '20' } = request.query as any
        const service = new AnnouncerService(ctx)
        const data = await service.listTasks(guildId, {
          status: status || undefined,
          page: parseInt(page, 10) || 1,
          size: parseInt(size, 10) || 20,
        })
        reply.send({ success: true, data })
      },
    },
    {
      method: 'POST',
      path: '/tasks/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const body = request.body as any
        if (!body?.title || !body?.content || !body?.scheduleAt || !body?.channelId || !body?.createdBy) {
          reply.code(400).send({ success: false, error: '缺少必要参数' })
          return
        }
        const scheduleAt = new Date(body.scheduleAt)
        if (Number.isNaN(scheduleAt.getTime())) {
          reply.code(400).send({ success: false, error: '时间格式错误' })
          return
        }

        const service = new AnnouncerService(ctx)
        const id = await service.createTask({
          guildId,
          channelId: body.channelId,
          title: body.title,
          content: body.content,
          scheduleAt,
          createdBy: body.createdBy,
        })
        reply.send({ success: true, data: { id } })
      },
    },
    {
      method: 'POST',
      path: '/tasks/:id/cancel',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        if (!id) {
          reply.code(400).send({ success: false, error: '无效任务ID' })
          return
        }
        const service = new AnnouncerService(ctx)
        const affected = await service.cancelTask(id)
        reply.send({ success: true, data: { affected } })
      },
    },
    {
      method: 'POST',
      path: '/tasks/:id/send',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        if (!id) {
          reply.code(400).send({ success: false, error: '无效任务ID' })
          return
        }
        const service = new AnnouncerService(ctx)
        const data = await service.sendNow(id)
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
        for (const key of ['enabled', 'max_retry', 'retry_delay_minutes']) {
          if (body?.[key] !== undefined) {
            await ctx.setConfig(key, body[key])
          }
        }
        reply.send({ success: true })
      },
    },
  ]
}
