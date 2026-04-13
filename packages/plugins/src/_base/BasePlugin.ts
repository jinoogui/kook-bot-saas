import { z } from 'zod'
import type {
  IPlugin,
  PluginContext,
  PluginCategory,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'

export abstract class BasePlugin implements IPlugin {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly description: string
  abstract readonly version: string
  abstract readonly category: PluginCategory
  readonly dependencies: string[] = []

  protected ctx!: PluginContext

  async onLoad(ctx: PluginContext): Promise<void> {
    this.ctx = ctx
  }

  async onUnload(): Promise<void> {}

  getSchema(): Record<string, any> {
    return {}
  }

  getCommands(): CommandDefinition[] {
    return []
  }

  getEventHandlers(): EventHandlerDefinition[] {
    return []
  }

  getApiRoutes(): ApiRouteDefinition[] {
    return []
  }

  getTimers(): TimerDefinition[] {
    return []
  }

  getConfigSchema(): z.ZodObject<any> {
    return z.object({})
  }

  getService(): unknown {
    return null
  }
}
