import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginEventsItems, pluginEventsParticipants } from './schema.js'
import { EventsService } from './service.js'
import { getCommands } from './commands.js'
import { getEventHandlers } from './events.js'
import { getApiRoutes } from './routes.js'
import { eventsConfigSchema } from './configSchema.js'

export class EventsPlugin extends BasePlugin {
  readonly id = 'events'
  readonly name = '活动报名'
  readonly description = '支持活动创建、报名、提醒和结束流程'
  readonly version = '1.0.0'
  readonly category = 'social' as const

  private service!: EventsService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new EventsService(ctx)
  }

  override getSchema(): Record<string, any> {
    return { pluginEventsItems, pluginEventsParticipants }
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
        name: 'events-timer',
        intervalMs: 60_000,
        handler: async (ctx: PluginContext) => {
          const service = new EventsService(ctx)
          await service.processEventTimers()
        },
      },
    ]
  }

  override getConfigSchema(): z.ZodObject<any> {
    return eventsConfigSchema
  }

  override getService(): EventsService {
    return this.service
  }
}
