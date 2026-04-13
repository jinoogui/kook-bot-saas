import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { eq, and } from 'drizzle-orm'
import { pluginRoleClaimConfigs } from './schema.js'
import { RoleClaimService } from './service.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/configs/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const rows = await ctx.db.drizzle
          .select()
          .from(pluginRoleClaimConfigs)
          .where(and(
            eq(pluginRoleClaimConfigs.tenantId, ctx.tenantId),
            eq(pluginRoleClaimConfigs.guildId, guildId),
          ))
        reply.send({ success: true, data: rows })
      },
    },
    {
      method: 'POST',
      path: '/configs/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const body = request.body as { channel_id: string; role_id: string; label?: string; emoji?: string }
        if (!body.channel_id || !body.role_id) {
          reply.code(400).send({ success: false, message: '缺少 channel_id 或 role_id' })
          return
        }
        await ctx.db.drizzle.insert(pluginRoleClaimConfigs).values({
          tenantId: ctx.tenantId,
          guildId,
          channelId: body.channel_id,
          roleId: body.role_id,
          label: body.label,
          emoji: body.emoji,
        })
        reply.send({ success: true })
      },
    },
    {
      method: 'DELETE',
      path: '/configs/:id',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { id } = request.params as { id: string }
        await ctx.db.drizzle
          .delete(pluginRoleClaimConfigs)
          .where(and(
            eq(pluginRoleClaimConfigs.tenantId, ctx.tenantId),
            eq(pluginRoleClaimConfigs.id, parseInt(id)),
          ))
        reply.send({ success: true })
      },
    },
    {
      method: 'POST',
      path: '/panel/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const body = request.body as { channel_id: string; title?: string; roles: Array<{ roleId: string; label: string; emoji?: string }> }
        if (!body.channel_id || !body.roles?.length) {
          reply.code(400).send({ success: false, message: '缺少 channel_id 或 roles' })
          return
        }
        const service = new RoleClaimService(ctx)
        await service.createPanel(guildId, body.channel_id, body.title ?? '领取身份组', body.roles)
        reply.send({ success: true })
      },
    },
  ]
}
