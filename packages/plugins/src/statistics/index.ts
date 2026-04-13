import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginStatsActivityStats, pluginStatsOnlineStats, pluginStatsUserActivity } from './schema.js'
import { StatisticsService } from './service.js'
import { getEventHandlers } from './events.js'
import { getCommands } from './commands.js'
import { getApiRoutes } from './routes.js'
import { statisticsConfigSchema } from './configSchema.js'

export class StatisticsPlugin extends BasePlugin {
  readonly id = 'statistics'
  readonly name = '活跃统计'
  readonly description = '消息活跃统计、在线人数追踪和排行榜功能'
  readonly version = '1.0.0'
  readonly category = 'utility' as const

  private service!: StatisticsService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new StatisticsService(ctx)
  }

  override getSchema(): Record<string, any> {
    return { pluginStatsActivityStats, pluginStatsOnlineStats, pluginStatsUserActivity }
  }

  override getCommands(): CommandDefinition[] {
    return getCommands()
  }

  override getEventHandlers(): EventHandlerDefinition[] {
    return getEventHandlers()
  }

  override getApiRoutes(): ApiRouteDefinition[] {
    return getApiRoutes()
  }

  override getConfigSchema(): z.ZodObject<any> {
    return statisticsConfigSchema
  }

  override getService(): StatisticsService {
    return this.service
  }
}
