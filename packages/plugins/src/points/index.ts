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
  pluginPointsCheckinRecords,
  pluginPointsUserPoints,
  pluginPointsShopItems,
  pluginPointsShopExchanges,
  pluginPointsRewardRecords,
  pluginPointsBoxRewardConfigs,
} from './schema.js'
import { PointsService } from './service.js'
import { getCommands } from './commands.js'
import { getApiRoutes } from './routes.js'
import { pointsConfigSchema } from './configSchema.js'

export class PointsPlugin extends BasePlugin {
  readonly id = 'points'
  readonly name = '积分系统'
  readonly description = '签到、积分、排行榜、商店、宝箱等积分相关功能'
  readonly version = '1.0.0'
  readonly category = 'engagement' as const

  private service!: PointsService

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new PointsService(ctx)
  }

  override getSchema(): Record<string, any> {
    return {
      pluginPointsCheckinRecords,
      pluginPointsUserPoints,
      pluginPointsShopItems,
      pluginPointsShopExchanges,
      pluginPointsRewardRecords,
      pluginPointsBoxRewardConfigs,
    }
  }

  override getCommands(): CommandDefinition[] {
    return getCommands()
  }

  override getApiRoutes(): ApiRouteDefinition[] {
    return getApiRoutes()
  }

  override getConfigSchema(): z.ZodObject<any> {
    return pointsConfigSchema
  }

  override getService(): PointsService {
    return this.service
  }
}
