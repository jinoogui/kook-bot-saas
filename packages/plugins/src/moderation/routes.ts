import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { ModerationService } from './service.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/bans/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const service = new ModerationService(ctx)
        const bans = await service.getBans(guildId)
        reply.send({ success: true, data: bans })
      },
    },
    {
      method: 'GET',
      path: '/ads/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const service = new ModerationService(ctx)
        const ads = await service.getAdKeywords(guildId)
        reply.send({ success: true, data: ads })
      },
    },
    {
      method: 'POST',
      path: '/ads/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const { keyword } = request.body as { keyword: string }
        if (!keyword) { reply.code(400).send({ success: false, message: '缺少 keyword' }); return }
        const service = new ModerationService(ctx)
        await service.addAdKeyword(guildId, keyword)
        reply.send({ success: true })
      },
    },
    {
      method: 'DELETE',
      path: '/ads/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const { keyword } = request.body as { keyword: string }
        if (!keyword) { reply.code(400).send({ success: false, message: '缺少 keyword' }); return }
        const service = new ModerationService(ctx)
        await service.removeAdKeyword(guildId, keyword)
        reply.send({ success: true })
      },
    },
  ]
}
