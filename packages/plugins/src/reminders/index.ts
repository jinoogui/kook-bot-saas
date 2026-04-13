import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginReminders } from './schema.js'
import { ReminderService } from './service.js'
import { getCommands } from './commands.js'

const remindersConfigSchema = z.object({
  /** 最大提醒数（每个用户每个服务器） */
  max_reminders_per_user: z.number().int().min(1).default(20),
})

export class RemindersPlugin extends BasePlugin {
  readonly id = 'reminders'
  readonly name = '提醒系统'
  readonly description = '设置定时提醒，支持相对时间和绝对时间'
  readonly version = '1.0.0'
  readonly category = 'utility' as const

  private service!: ReminderService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new ReminderService(ctx)
  }

  override getSchema(): Record<string, any> {
    return { pluginReminders }
  }

  override getCommands(): CommandDefinition[] {
    return getCommands()
  }

  override getTimers(): TimerDefinition[] {
    return [
      {
        name: 'reminder-check',
        intervalMs: 30_000,
        immediate: false,
        handler: async (ctx: PluginContext): Promise<void> => {
          const service = new ReminderService(ctx)
          await service.checkAndSend()
        },
      },
    ]
  }

  override getConfigSchema(): z.ZodObject<any> {
    return remindersConfigSchema
  }

  override getService(): ReminderService {
    return this.service
  }
}
