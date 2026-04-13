import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginWelcomeMessages } from './schema.js'
import { WelcomeService } from './service.js'
import { getEventHandlers } from './events.js'
import { getApiRoutes } from './routes.js'
import { welcomeConfigSchema } from './configSchema.js'

export class WelcomePlugin extends BasePlugin {
  readonly id = 'welcome'
  readonly name = '欢迎系统'
  readonly description = '自动发送欢迎/欢送消息，支持 KMarkdown 和卡片模式'
  readonly version = '1.0.0'
  readonly category = 'engagement' as const

  private service!: WelcomeService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new WelcomeService(ctx)
  }

  override getSchema(): Record<string, any> {
    return { pluginWelcomeMessages }
  }

  override getEventHandlers(): EventHandlerDefinition[] {
    return getEventHandlers()
  }

  override getApiRoutes(): ApiRouteDefinition[] {
    return getApiRoutes()
  }

  override getConfigSchema(): z.ZodObject<any> {
    return welcomeConfigSchema
  }

  override getService(): WelcomeService {
    return this.service
  }
}
