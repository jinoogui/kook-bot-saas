import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginVoiceOnlineRecords, pluginVoicePointsDaily } from './schema.js'
import { VoicePointsService } from './service.js'
import { getEventHandlers } from './events.js'
import { voicePointsConfigSchema } from './configSchema.js'

export class VoicePointsPlugin extends BasePlugin {
  readonly id = 'voice-points'
  readonly name = '语音积分'
  readonly description = '语音频道挂机获得积分奖励，支持每日上限和每小时积分配置'
  readonly version = '1.0.0'
  readonly category = 'engagement' as const
  readonly dependencies = ['points']

  private service!: VoicePointsService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new VoicePointsService(ctx)
    await this.service.recoverOnStartup()
  }

  override getSchema(): Record<string, any> {
    return { pluginVoiceOnlineRecords, pluginVoicePointsDaily }
  }

  override getEventHandlers(): EventHandlerDefinition[] {
    return getEventHandlers()
  }

  override getTimers(): TimerDefinition[] {
    return [{
      name: 'voice-points-settle',
      intervalMs: 5 * 60 * 1000,
      handler: async (ctx: PluginContext) => {
        const svc = new VoicePointsService(ctx)
        await svc.periodicSettle()
      },
    }]
  }

  override getConfigSchema(): z.ZodObject<any> {
    return voicePointsConfigSchema
  }

  override getService(): VoicePointsService {
    return this.service
  }
}
