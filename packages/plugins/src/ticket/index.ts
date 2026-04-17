import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginTicketLogs, pluginTicketTickets } from './schema.js'
import { TicketService } from './service.js'
import { getCommands } from './commands.js'
import { getEventHandlers } from './events.js'
import { getApiRoutes } from './routes.js'
import { ticketConfigSchema } from './configSchema.js'

export class TicketPlugin extends BasePlugin {
  readonly id = 'ticket'
  readonly name = '工单系统'
  readonly description = '支持工单创建、分配、关闭与跟踪日志'
  readonly version = '1.0.0'
  readonly category = 'utility' as const

  private service!: TicketService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new TicketService(ctx)
  }

  override getSchema(): Record<string, any> {
    return { pluginTicketTickets, pluginTicketLogs }
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
        name: 'ticket-auto-close',
        intervalMs: 300_000,
        handler: async (ctx: PluginContext) => {
          const service = new TicketService(ctx)
          await service.autoCloseExpired()
        },
      },
    ]
  }

  override getConfigSchema(): z.ZodObject<any> {
    return ticketConfigSchema
  }

  override getService(): TicketService {
    return this.service
  }
}
