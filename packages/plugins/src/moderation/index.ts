import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginModerationBans, pluginModerationMutes, pluginModerationAds } from './schema.js'
import { ModerationService } from './service.js'
import { getCommands } from './commands.js'
import { getApiRoutes } from './routes.js'
import { moderationConfigSchema } from './configSchema.js'

export class ModerationPlugin extends BasePlugin {
  readonly id = 'moderation'
  readonly name = '管理工具'
  readonly description = '用户封禁、禁言、广告词过滤等管理功能'
  readonly version = '1.0.0'
  readonly category = 'moderation' as const

  private service!: ModerationService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new ModerationService(ctx)
  }

  override getSchema(): Record<string, any> {
    return { pluginModerationBans, pluginModerationMutes, pluginModerationAds }
  }

  override getCommands(): CommandDefinition[] {
    return getCommands()
  }

  override getApiRoutes(): ApiRouteDefinition[] {
    return getApiRoutes()
  }

  override getConfigSchema(): z.ZodObject<any> {
    return moderationConfigSchema
  }

  override getService(): ModerationService {
    return this.service
  }
}
