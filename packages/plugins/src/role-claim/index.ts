import type {
  PluginContext,
  CommandDefinition,
  EventHandlerDefinition,
  ApiRouteDefinition,
  TimerDefinition,
} from '@kook-saas/shared'
import { z } from 'zod'
import { BasePlugin } from '../_base/BasePlugin.js'
import { pluginRoleClaimConfigs } from './schema.js'
import { RoleClaimService } from './service.js'
import { getEventHandlers } from './events.js'
import { getApiRoutes } from './routes.js'
import { roleClaimConfigSchema } from './configSchema.js'

export class RoleClaimPlugin extends BasePlugin {
  readonly id = 'role-claim'
  readonly name = '身份组领取'
  readonly description = '通过按钮点击自助领取/取消身份组，支持面板卡片消息'
  readonly version = '1.0.0'
  readonly category = 'social' as const

  private service!: RoleClaimService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new RoleClaimService(ctx)
  }

  override getSchema(): Record<string, any> {
    return { pluginRoleClaimConfigs }
  }

  override getEventHandlers(): EventHandlerDefinition[] {
    return getEventHandlers()
  }

  override getApiRoutes(): ApiRouteDefinition[] {
    return getApiRoutes()
  }

  override getConfigSchema(): z.ZodObject<any> {
    return roleClaimConfigSchema
  }

  override getService(): RoleClaimService {
    return this.service
  }
}
