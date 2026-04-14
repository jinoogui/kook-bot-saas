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
  private commandNames: Record<string, string> = {}

  override async onLoad(ctx: PluginContext): Promise<void> {
    await super.onLoad(ctx)
    this.service = new PointsService(ctx)

    // Load custom command names from config
    try {
      const config = await ctx.getConfig()
      this.commandNames = {
        checkin: config.checkin_command || '签到',
        points: config.points_command || '积分',
        rank: config.rank_command || '排行榜',
        shop: config.shop_command || '商店',
        buy: config.buy_command || '购买',
        box: config.box_command || '宝箱',
      }
    } catch {
      // Defaults if config unavailable
    }
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
    return getCommands(this.commandNames)
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
