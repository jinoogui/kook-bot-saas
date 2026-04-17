import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginRaffleItems, pluginRaffleParticipants } from './schema.js'
import { RaffleService } from './service.js'
import { getCommands } from './commands.js'
import { getEventHandlers } from './events.js'
import { getApiRoutes } from './routes.js'
import { raffleConfigSchema } from './configSchema.js'

export class RafflePlugin extends BasePlugin {
  readonly id = 'raffle'
  readonly name = '抽奖系统'
  readonly description = '支持创建抽奖、参与抽奖和自动开奖'
  readonly version = '1.0.0'
  readonly category = 'social' as const

  private service!: RaffleService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new RaffleService(ctx)
  }

  override getSchema(): Record<string, any> {
    return { pluginRaffleItems, pluginRaffleParticipants }
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
        name: 'raffle-auto-draw',
        intervalMs: 60_000,
        handler: async (ctx: PluginContext) => {
          const service = new RaffleService(ctx)
          await service.processAutoDraw()
        },
      },
    ]
  }

  override getConfigSchema(): z.ZodObject<any> {
    return raffleConfigSchema
  }

  override getService(): RaffleService {
    return this.service
  }
}
