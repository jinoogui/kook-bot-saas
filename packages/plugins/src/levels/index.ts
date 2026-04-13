import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginLevelsUserActivity, pluginLevelsConfigs } from './schema.js'
import { LevelService } from './service.js'
import { getEventHandlers } from './events.js'
import { getCommands } from './commands.js'
import { getApiRoutes } from './routes.js'
import { levelConfigSchema } from './configSchema.js'

export class LevelPlugin extends BasePlugin {
  readonly id = 'levels'
  readonly name = '等级系统'
  readonly description = '消息经验值和等级系统，支持升级通知和排行榜'
  readonly version = '1.0.0'
  readonly category = 'engagement' as const

  private service!: LevelService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new LevelService(ctx)
  }

  override getSchema(): Record<string, any> {
    return { pluginLevelsUserActivity, pluginLevelsConfigs }
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
    return levelConfigSchema
  }

  override getService(): LevelService {
    return this.service
  }
}
