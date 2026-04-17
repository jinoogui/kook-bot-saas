import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginPollsItems, pluginPollsVotes } from './schema.js'
import { PollsService } from './service.js'
import { getCommands } from './commands.js'
import { getEventHandlers } from './events.js'
import { getApiRoutes } from './routes.js'
import { pollsConfigSchema } from './configSchema.js'

export class PollsPlugin extends BasePlugin {
  readonly id = 'polls'
  readonly name = '投票系统'
  readonly description = '支持创建投票、投票统计与自动结束'
  readonly version = '1.0.0'
  readonly category = 'social' as const

  private service!: PollsService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new PollsService(ctx)
  }

  override getSchema(): Record<string, any> {
    return { pluginPollsItems, pluginPollsVotes }
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
        name: 'polls-auto-close',
        intervalMs: 60_000,
        handler: async (ctx: PluginContext) => {
          const service = new PollsService(ctx)
          await service.autoCloseExpired()
        },
      },
    ]
  }

  override getConfigSchema(): z.ZodObject<any> {
    return pollsConfigSchema
  }

  override getService(): PollsService {
    return this.service
  }
}
