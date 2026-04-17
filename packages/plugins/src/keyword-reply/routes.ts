import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { eq, and } from 'drizzle-orm'
import { pluginKeywordReplies } from './schema.js'
import type { KeywordReplyService } from './service.js'

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
        const keyword = String(body.keyword || '').trim()
        const replyText = String(body.reply || '').trim()
        const matchType = String(body.match_type || 'contains')
        const allowedMatchTypes = new Set(['exact', 'prefix', 'suffix', 'contains'])

        if (!keyword || !replyText) {
          reply.code(400).send({ success: false, error: '缺少 keyword 或 reply' })
          return
        }
        if (keyword.length > 100) {
          reply.code(400).send({ success: false, error: 'keyword 过长（最大 100）' })
          return
        }
        if (replyText.length > 1000) {
          reply.code(400).send({ success: false, error: 'reply 过长（最大 1000）' })
          return
        }
        if (!allowedMatchTypes.has(matchType)) {
          reply.code(400).send({ success: false, error: '无效的 match_type' })
          return
        }

        await ctx.db.drizzle
          .insert(pluginKeywordReplies)
          .values({
            tenantId: ctx.tenantId,
            guildId,
            keyword,
            reply: replyText,
            matchType,
          })
        const service = ctx.getPluginService<KeywordReplyService>('keyword-reply')
        await service?.reloadGuild(guildId)
        reply.send({ success: true })
      },
    },
    {
      method: 'DELETE',
      path: '/rules/:id',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { id } = request.params as { id: string }
        const targetId = parseInt(id, 10)
        if (!targetId) {
          reply.code(400).send({ success: false, message: '无效规则ID' })
          return
        }

        const [existing] = await ctx.db.drizzle
          .select({ guildId: pluginKeywordReplies.guildId })
          .from(pluginKeywordReplies)
          .where(and(
            eq(pluginKeywordReplies.tenantId, ctx.tenantId),
            eq(pluginKeywordReplies.id, targetId),
          ))
          .limit(1)

        await ctx.db.drizzle
          .delete(pluginKeywordReplies)
          .where(and(
            eq(pluginKeywordReplies.tenantId, ctx.tenantId),
            eq(pluginKeywordReplies.id, targetId),
          ))

        if (existing?.guildId) {
          const service = ctx.getPluginService<KeywordReplyService>('keyword-reply')
          await service?.reloadGuild(existing.guildId)
        }

        reply.send({ success: true })
      },
    },
  ]
}
