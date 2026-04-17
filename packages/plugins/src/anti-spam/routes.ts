import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { AntiSpamService } from './service.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/rules/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const service = new AntiSpamService(ctx)
        const data = await service.getRule(guildId)
        reply.send({ success: true, data })
      },
    },
    {
      method: 'PUT',
      path: '/rules/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const body = request.body as any
        const service = new AntiSpamService(ctx)
        const data = await service.updateRule(guildId, {
          enabled: body?.enabled,
          maxMessagesPerWindow: body?.maxMessagesPerWindow,
          windowSeconds: body?.windowSeconds,
          duplicateThreshold: body?.duplicateThreshold,
          blockAtAll: body?.blockAtAll,
          actionType: body?.actionType,
          muteHours: body?.muteHours,
        })
        reply.send({ success: true, data })
      },
    },
    {
      method: 'GET',
      path: '/whitelist/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const service = new AntiSpamService(ctx)
        const data = await service.listWhitelist(guildId)
        reply.send({ success: true, data })
      },
    },
    {
      method: 'POST',
      path: '/whitelist/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const { userId } = request.body as any
        if (!userId) {
          reply.code(400).send({ success: false, error: '缺少 userId' })
          return
        }
        const service = new AntiSpamService(ctx)
        await service.addWhitelist(guildId, String(userId))
        reply.send({ success: true })
      },
    },
    {
      method: 'DELETE',
      path: '/whitelist/:guildId/:userId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId, userId } = request.params as { guildId: string; userId: string }
        const service = new AntiSpamService(ctx)
        const affected = await service.removeWhitelist(guildId, userId)
        reply.send({ success: true, data: { affected } })
      },
    },
    {
      method: 'GET',
      path: '/violations/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const page = parseInt((request.query as any)?.page ?? '1', 10) || 1
        const size = parseInt((request.query as any)?.size ?? '20', 10) || 20
        const service = new AntiSpamService(ctx)
        const data = await service.listViolations(guildId, page, size)
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
        const keys = [
          'enabled',
          'default_action',
          'default_window_seconds',
          'default_max_messages',
          'default_duplicate_threshold',
          'default_block_at_all',
          'default_mute_hours',
        ]
        for (const key of keys) {
          if (body?.[key] !== undefined) {
            await ctx.setConfig(key, body[key])
          }
        }
        reply.send({ success: true })
      },
    },
  ]
}
