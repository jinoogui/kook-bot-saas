import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginQuestsTemplates, pluginQuestsProgress } from './schema.js'
import { QuestsService } from './service.js'
import { getCommands } from './commands.js'
import { getEventHandlers } from './events.js'
import { getApiRoutes } from './routes.js'
import { questsConfigSchema } from './configSchema.js'

export class QuestsPlugin extends BasePlugin {
  readonly id = 'quests'
  readonly name = '每日任务'
  readonly description = '支持任务模板、进度累计与积分领奖'
  readonly version = '1.0.0'
  readonly category = 'engagement' as const
  readonly dependencies = ['points']

  private service!: QuestsService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new QuestsService(ctx)
  }

  override getSchema(): Record<string, any> {
    return { pluginQuestsTemplates, pluginQuestsProgress }
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

  override getTimers(): TimerDefinition[] {
    return []
  }

  override getConfigSchema(): z.ZodObject<any> {
    return questsConfigSchema
  }

  override getService(): QuestsService {
    return this.service
  }
}
