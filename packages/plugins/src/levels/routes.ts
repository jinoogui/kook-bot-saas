import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'
import { eq, and, desc } from 'drizzle-orm'
import { pluginLevelsConfigs, pluginLevelsUserActivity } from './schema.js'

export function getApiRoutes(): ApiRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/config/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const [row] = await ctx.db.drizzle
          .select()
          .from(pluginLevelsConfigs)
          .where(
            and(
              eq(pluginLevelsConfigs.tenantId, ctx.tenantId),
              eq(pluginLevelsConfigs.guildId, guildId),
            ),
          )
          .limit(1)
        reply.send({ success: true, data: row ?? { enabled: 0, xpPerMessage: 10, xpCooldown: 60 } })
      },
    },
    {
      method: 'POST',
      path: '/config/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const body = request.body as any
        await ctx.db.drizzle
          .insert(pluginLevelsConfigs)
          .values({
            tenantId: ctx.tenantId,
            guildId,
            enabled: body.enabled ? 1 : 0,
            xpPerMessage: body.xp_per_message ?? 10,
            xpCooldown: body.xp_cooldown ?? 60,
            levelUpChannel: body.level_up_channel,
          })
          .onDuplicateKeyUpdate({
            set: {
              enabled: body.enabled ? 1 : 0,
              xpPerMessage: body.xp_per_message ?? 10,
              xpCooldown: body.xp_cooldown ?? 60,
              levelUpChannel: body.level_up_channel,
            },
          })
        reply.send({ success: true })
      },
    },
    {
      method: 'GET',
      path: '/leaderboard/:guildId',
      auth: true,
      handler: async (request: any, reply: any, ctx: PluginContext): Promise<void> => {
        const { guildId } = request.params as { guildId: string }
        const limit = parseInt((request.query as any)?.limit ?? '10')
        const rows = await ctx.db.drizzle
          .select()
          .from(pluginLevelsUserActivity)
          .where(
            and(
              eq(pluginLevelsUserActivity.tenantId, ctx.tenantId),
              eq(pluginLevelsUserActivity.guildId, guildId),
            ),
          )
          .orderBy(desc(pluginLevelsUserActivity.totalXp))
          .limit(limit)
        reply.send({ success: true, data: rows })
      },
    },
  ]
}
