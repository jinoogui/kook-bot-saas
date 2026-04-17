import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { TicketService } from './service.js'

function isPrivilegedOperator(operatorRole?: string): boolean {
  return operatorRole === 'admin' || operatorRole === 'owner'
}

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/tickets/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const { status, page = '1', size = '20' } = request.query as any
        const service = new TicketService(ctx)
        try {
          const data = await service.listTickets(guildId, {
            status: status || undefined,
            page: parseInt(page, 10) || 1,
            size: parseInt(size, 10) || 20,
          })
          reply.send({ success: true, data })
        } catch (err: any) {
          reply.code(400).send({ success: false, error: err?.message || '查询工单失败' })
        }
      },
    },
    {
      method: 'POST',
      path: '/tickets/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const body = request.body as any
        if (!body?.title || !body?.creatorUserId) {
          reply.code(400).send({ success: false, error: '缺少 title/creatorUserId' })
          return
        }

        const service = new TicketService(ctx)
        try {
          const id = await service.createTicket({
            guildId,
            channelId: body.channelId || '',
            creatorUserId: body.creatorUserId,
            title: body.title,
            content: body.content,
            priority: body.priority,
          })
          reply.send({ success: true, data: { id } })
        } catch (err: any) {
          reply.code(400).send({ success: false, error: err?.message || '创建工单失败' })
        }
      },
    },
    {
      method: 'GET',
      path: '/tickets/detail/:id',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        if (!id) {
          reply.code(400).send({ success: false, error: '无效工单ID' })
          return
        }
        const service = new TicketService(ctx)
        const ticket = await service.getTicket(id)
        if (!ticket) {
          reply.code(404).send({ success: false, error: '工单不存在' })
          return
        }
        const logs = await service.getLogs(id)
        reply.send({ success: true, data: { ticket, logs } })
      },
    },
    {
      method: 'POST',
      path: '/tickets/:id/assign',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        const { assigneeUserId, operatorUserId, operatorRole } = request.body as any
        if (!id || !assigneeUserId || !operatorUserId) {
          reply.code(400).send({ success: false, error: '缺少参数' })
          return
        }
        if (!isPrivilegedOperator(operatorRole)) {
          reply.code(403).send({ success: false, code: 'TICKET_FORBIDDEN', error: '仅管理员可执行指派' })
          return
        }

        const service = new TicketService(ctx)
        const result = await service.assignTicket(id, assigneeUserId, operatorUserId)
        if (result.affected === 0) {
          const notFound = result.message.includes('不存在')
          reply.code(notFound ? 404 : 409).send({ success: false, error: result.message })
          return
        }
        reply.send({ success: true, data: result })
      },
    },
    {
      method: 'POST',
      path: '/tickets/:id/close',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const id = parseInt((request.params as any).id, 10)
        const { operatorUserId, reason, operatorRole } = request.body as any
        if (!id || !operatorUserId) {
          reply.code(400).send({ success: false, error: '缺少参数' })
          return
        }
        if (!isPrivilegedOperator(operatorRole)) {
          reply.code(403).send({ success: false, code: 'TICKET_FORBIDDEN', error: '仅管理员可关闭工单' })
          return
        }

        const service = new TicketService(ctx)
        const result = await service.closeTicket(id, operatorUserId, reason)
        if (result.affected === 0) {
          const notFound = result.message.includes('不存在')
          reply.code(notFound ? 404 : 409).send({ success: false, error: result.message })
          return
        }
        reply.send({ success: true, data: result })
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
        const keys = ['support_channel_id', 'default_priority', 'auto_close_hours']
        for (const key of keys) {
          if (body?.[key] !== undefined) {
            await ctx.setConfig(key, body[key])
          }
        }
        reply.send({
          success: true,
          data: {
            updatedKeys: keys.filter((key) => body?.[key] !== undefined),
            docs: {
              support_channel_id: '默认受理频道；为空时创建接口需显式传 channelId',
              default_priority: '工单默认优先级，可选 low/normal/high',
              auto_close_hours: '自动关闭阈值（小时），0 表示关闭自动关闭',
            },
          },
        })
      },
    },
  ]
}
