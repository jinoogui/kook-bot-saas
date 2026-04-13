import type { IPlugin } from '@kook-saas/shared'

// ── Base ────────────────────────────────────────
export { BasePlugin } from './_base/BasePlugin.js'

// ── Welcome Plugin ──────────────────────────────
export { WelcomePlugin } from './welcome/index.js'
export { WelcomeService } from './welcome/service.js'
export { pluginWelcomeMessages } from './welcome/schema.js'

// ── Points Plugin ───────────────────────────────
export { PointsPlugin } from './points/index.js'
export { PointsService } from './points/service.js'
export type { CheckinResult } from './points/service.js'
export {
  pluginPointsCheckinRecords,
  pluginPointsUserPoints,
  pluginPointsShopItems,
  pluginPointsShopExchanges,
  pluginPointsRewardRecords,
  pluginPointsBoxRewardConfigs,
} from './points/schema.js'

// ── Content Filter Plugin ───────────────────────
export { ContentFilterPlugin } from './content-filter/index.js'
export { FilterService } from './content-filter/service.js'
export type { FilterResult } from './content-filter/service.js'
export {
  pluginFilterAds,
  pluginFilterViolationRecords,
} from './content-filter/schema.js'

// ── Reminders Plugin ────────────────────────────
export { RemindersPlugin } from './reminders/index.js'
export { ReminderService } from './reminders/service.js'
export { pluginReminders } from './reminders/schema.js'

// ── Plugin Registry ─────────────────────────────
import { WelcomePlugin } from './welcome/index.js'
import { PointsPlugin } from './points/index.js'
import { ContentFilterPlugin } from './content-filter/index.js'
import { RemindersPlugin } from './reminders/index.js'

/**
 * 返回所有已注册插件的实例列表
 */
export function getAllPlugins(): IPlugin[] {
  return [
    new WelcomePlugin(),
    new PointsPlugin(),
    new ContentFilterPlugin(),
    new RemindersPlugin(),
  ]
}
