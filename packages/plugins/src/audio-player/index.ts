import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { AudioPlayerService } from './service.js'
import { getCommands } from './commands.js'
import { audioPlayerConfigSchema } from './configSchema.js'

export class AudioPlayerPlugin extends BasePlugin {
  readonly id = 'audio-player'
  readonly name = '音频播放'
  readonly description = '语音频道音频播放器，支持 URL 播放、音量调节等'
  readonly version = '1.0.0'
  readonly category = 'media' as const

  private service!: AudioPlayerService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new AudioPlayerService(ctx)
  }

  override async onUnload(): Promise<void> {
    await this.service.destroyAll()
  }

  override getCommands(): CommandDefinition[] {
    return getCommands()
  }

  override getConfigSchema(): z.ZodObject<any> {
    return audioPlayerConfigSchema
  }

  override getService(): AudioPlayerService {
    return this.service
  }
}
