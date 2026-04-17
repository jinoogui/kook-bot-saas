import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginAnnouncerTasks } from './schema.js'
import { AnnouncerService } from './service.js'
import { getCommands } from './commands.js'
import { getEventHandlers } from './events.js'
import { getApiRoutes } from './routes.js'
import { announcerConfigSchema } from './configSchema.js'

export class AnnouncerPlugin extends BasePlugin {
  readonly id = 'announcer'
  readonly name = '定时公告'
  readonly description = '支持创建定时公告并自动投递到频道'
  readonly version = '1.0.0'
  readonly category = 'utility' as const

  private service!: AnnouncerService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new AnnouncerService(ctx)
  }

  override getSchema(): Record<string, any> {
    return { pluginAnnouncerTasks }
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
    return [
      {
        name: 'announcer-scan',
        intervalMs: 30_000,
        handler: async (ctx: PluginContext) => {
          const service = new AnnouncerService(ctx)
          await service.processScheduled()
        },
      },
    ]
  }

  override getConfigSchema(): z.ZodObject<any> {
    return announcerConfigSchema
  }

  override getService(): AnnouncerService {
    return this.service
  }
}
