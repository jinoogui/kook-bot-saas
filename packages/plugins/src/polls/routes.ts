import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { PollsService } from './service.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/items/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const { status, page = '1', size = '20' } = request.query as any
        const service = new PollsService(ctx)
        const data = await service.listPolls(guildId, {
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
        if (!body?.title || !Array.isArray(body?.options) || body.options.length < 2 || !body?.channelId || !body?.createdBy) {
          reply.code(400).send({ success: false, error: '缺少必要参数' })
          return
        }
        let endsAt: Date | null = null
        if (body.endsAt) {
          const parsed = new Date(body.endsAt)
          if (Number.isNaN(parsed.getTime())) {
            reply.code(400).send({ success: false, error: '结束时间格式错误' })
            return
          }
          endsAt = parsed
        }

        const service = new PollsService(ctx)
        const id = await service.createPoll({
          guildId,
          channelId: body.channelId,
          title: body.title,
          options: body.options,
          allowMulti: !!body.allowMulti,
          endsAt,
          createdBy: body.createdBy,
        })
        reply.send({ success: true, data: { id } })
      },
    },
    {
      method: 'POST',
      path: '/items/:id/vote',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        const { guildId, userId, optionKeys } = request.body as any
        if (!id || !guildId || !userId || !Array.isArray(optionKeys)) {
          reply.code(400).send({ success: false, error: '缺少参数' })
          return
        }
        const service = new PollsService(ctx)
        const data = await service.vote(id, guildId, userId, optionKeys)
        reply.send({ success: true, data })
      },
    },
    {
      method: 'GET',
      path: '/items/:id/result',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        if (!id) {
          reply.code(400).send({ success: false, error: '无效投票ID' })
          return
        }
        const service = new PollsService(ctx)
        const data = await service.getResults(id)
        if (!data) {
          reply.code(404).send({ success: false, error: '投票不存在' })
          return
        }
        reply.send({ success: true, data })
      },
    },
    {
      method: 'POST',
      path: '/items/:id/close',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        if (!id) {
          reply.code(400).send({ success: false, error: '无效投票ID' })
          return
        }
        const service = new PollsService(ctx)
        const affected = await service.closePoll(id)
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
        for (const key of ['default_duration_minutes', 'default_allow_multi']) {
          if (body?.[key] !== undefined) {
            await ctx.setConfig(key, body[key])
          }
        }
        reply.send({ success: true })
      },
    },
  ]
}
