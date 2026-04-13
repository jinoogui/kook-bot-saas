import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginKeywordReplies, pluginAutoReplies } from './schema.js'
import { KeywordReplyService } from './service.js'
import { getEventHandlers } from './events.js'
import { getApiRoutes } from './routes.js'
import { keywordReplyConfigSchema } from './configSchema.js'

export class KeywordReplyPlugin extends BasePlugin {
  readonly id = 'keyword-reply'
  readonly name = '关键词回复'
  readonly description = '自动检测消息关键词并回复，支持精确/前缀/后缀/包含四种匹配模式'
  readonly version = '1.0.0'
  readonly category = 'utility' as const

  private service!: KeywordReplyService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new KeywordReplyService(ctx)
    await this.service.init()
  }

  override getSchema(): Record<string, any> {
    return { pluginKeywordReplies, pluginAutoReplies }
  }

  override getEventHandlers(): EventHandlerDefinition[] {
    return getEventHandlers()
  }

  override getApiRoutes(): ApiRouteDefinition[] {
    return getApiRoutes()
  }

  override getConfigSchema(): z.ZodObject<any> {
    return keywordReplyConfigSchema
  }

  override getService(): KeywordReplyService {
    return this.service
  }
}
