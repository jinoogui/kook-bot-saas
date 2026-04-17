import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import {
  pluginAntiSpamRules,
  pluginAntiSpamViolations,
  pluginAntiSpamWhitelist,
} from './schema.js'
import { antiSpamConfigSchema } from './configSchema.js'
import { AntiSpamService } from './service.js'
import { getCommands } from './commands.js'
import { getEventHandlers } from './events.js'
import { getApiRoutes } from './routes.js'

export class AntiSpamPlugin extends BasePlugin {
  readonly id = 'anti-spam'
  readonly name = '防刷屏'
  readonly description = '消息频率、重复内容与@全体检测拦截'
  readonly version = '1.0.0'
  readonly category = 'moderation' as const

  private service!: AntiSpamService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new AntiSpamService(ctx)
  }

  override getSchema(): Record<string, any> {
    return {
      pluginAntiSpamRules,
      pluginAntiSpamViolations,
      pluginAntiSpamWhitelist,
    }
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
    return antiSpamConfigSchema
  }

  override getService(): AntiSpamService {
    return this.service
  }
}
