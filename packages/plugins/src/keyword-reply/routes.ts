import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { eq, and } from 'drizzle-orm'
import { pluginKeywordReplies } from './schema.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/rules/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const rows = await ctx.db.drizzle
          .select()
          .from(pluginKeywordReplies)
          .where(and(
            eq(pluginKeywordReplies.tenantId, ctx.tenantId),
            eq(pluginKeywordReplies.guildId, guildId),
          ))
        reply.send({ success: true, data: rows })
      },
    },
    {
      method: 'POST',
      path: '/rules/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const body = request.body as { keyword: string; reply: string; match_type?: string }
        if (!body.keyword || !body.reply) {
          reply.code(400).send({ success: false, message: '缺少 keyword 或 reply' })
          return
        }
        await ctx.db.drizzle
          .insert(pluginKeywordReplies)
          .values({
            tenantId: ctx.tenantId,
            guildId,
            keyword: body.keyword,
            reply: body.reply,
            matchType: body.match_type ?? 'contains',
          })
        reply.send({ success: true })
      },
    },
    {
      method: 'DELETE',
      path: '/rules/:id',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { id } = request.params as { id: string }
        await ctx.db.drizzle
          .delete(pluginKeywordReplies)
          .where(and(
            eq(pluginKeywordReplies.tenantId, ctx.tenantId),
            eq(pluginKeywordReplies.id, parseInt(id)),
          ))
        reply.send({ success: true })
      },
    },
  ]
}
