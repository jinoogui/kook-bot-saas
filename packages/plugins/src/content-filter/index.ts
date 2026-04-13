import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginFilterAds, pluginFilterViolationRecords } from './schema.js'
import { FilterService } from './service.js'
import { getEventHandlers } from './events.js'

const contentFilterConfigSchema = z.object({
  /** 是否启用广告检测 */
  enable_ad_detection: z.boolean().default(true),
  /** 是否启用违规词检测 */
  enable_violation_detection: z.boolean().default(true),
  /** 是否检测 URL */
  filter_url_check: z.boolean().default(false),
})

export class ContentFilterPlugin extends BasePlugin {
  readonly id = 'content-filter'
  readonly name = '内容过滤'
  readonly description = '自动检测并删除广告、违规词、恶意链接等消息'
  readonly version = '1.0.0'
  readonly category = 'moderation' as const

  private service!: FilterService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new FilterService(ctx)
    await this.service.init()
  }

  override getSchema(): Record<string, any> {
    return { pluginFilterAds, pluginFilterViolationRecords }
  }

  override getEventHandlers(): EventHandlerDefinition[] {
    return getEventHandlers()
  }

  override getConfigSchema(): z.ZodObject<any> {
    return contentFilterConfigSchema
  }

  override getService(): FilterService {
    return this.service
  }
}
