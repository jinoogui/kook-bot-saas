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

// ── Keyword Reply Plugin ────────────────────────
export { KeywordReplyPlugin } from './keyword-reply/index.js'
export { KeywordReplyService } from './keyword-reply/service.js'
export {
  pluginKeywordReplies,
  pluginAutoReplies,
} from './keyword-reply/schema.js'

// ── Role Claim Plugin ──────────────────────────
export { RoleClaimPlugin } from './role-claim/index.js'
export { RoleClaimService } from './role-claim/service.js'
export { pluginRoleClaimConfigs } from './role-claim/schema.js'

// ── Statistics Plugin ───────────────────────────
export { StatisticsPlugin } from './statistics/index.js'
export { StatisticsService } from './statistics/service.js'
export {
  pluginStatsActivityStats,
  pluginStatsOnlineStats,
  pluginStatsUserActivity,
} from './statistics/schema.js'

// ── Audio Player Plugin ────────────────────────
export { AudioPlayerPlugin } from './audio-player/index.js'
export { AudioPlayerService, PipelinePlayer, PlayStatus } from './audio-player/service.js'
export type { StreamInfo } from './audio-player/service.js'

// ── Moderation Plugin ──────────────────────────
export { ModerationPlugin } from './moderation/index.js'
export { ModerationService } from './moderation/service.js'
export {
  pluginModerationBans,
  pluginModerationMutes,
  pluginModerationAds,
} from './moderation/schema.js'

// ── Voice Points Plugin ────────────────────────
export { VoicePointsPlugin } from './voice-points/index.js'
export { VoicePointsService } from './voice-points/service.js'
export {
  pluginVoiceOnlineRecords,
  pluginVoicePointsDaily,
} from './voice-points/schema.js'

// ── Levels Plugin ──────────────────────────────
export { LevelPlugin } from './levels/index.js'
export { LevelService } from './levels/service.js'
export {
  pluginLevelsUserActivity,
  pluginLevelsConfigs,
} from './levels/schema.js'

// ── Ticket Plugin ──────────────────────────────
export { TicketPlugin } from './ticket/index.js'
export { TicketService } from './ticket/service.js'
export {
  pluginTicketTickets,
  pluginTicketLogs,
} from './ticket/schema.js'

// ── Events Plugin ──────────────────────────────
export { EventsPlugin } from './events/index.js'
export { EventsService } from './events/service.js'
export {
  pluginEventsItems,
  pluginEventsParticipants,
} from './events/schema.js'

// ── Raffle Plugin ──────────────────────────────
export { RafflePlugin } from './raffle/index.js'
export { RaffleService } from './raffle/service.js'
export {
  pluginRaffleItems,
  pluginRaffleParticipants,
} from './raffle/schema.js'

// ── Polls Plugin ───────────────────────────────
export { PollsPlugin } from './polls/index.js'
export { PollsService } from './polls/service.js'
export {
  pluginPollsItems,
  pluginPollsVotes,
} from './polls/schema.js'

// ── Quests Plugin ──────────────────────────────
export { QuestsPlugin } from './quests/index.js'
export { QuestsService } from './quests/service.js'
export {
  pluginQuestsTemplates,
  pluginQuestsProgress,
} from './quests/schema.js'

// ── Announcer Plugin ───────────────────────────
export { AnnouncerPlugin } from './announcer/index.js'
export { AnnouncerService } from './announcer/service.js'
export {
  pluginAnnouncerTasks,
} from './announcer/schema.js'

// ── Anti Spam Plugin ───────────────────────────
export { AntiSpamPlugin } from './anti-spam/index.js'
export { AntiSpamService } from './anti-spam/service.js'
export {
  pluginAntiSpamRules,
  pluginAntiSpamViolations,
  pluginAntiSpamWhitelist,
} from './anti-spam/schema.js'

// ── Plugin Registry ─────────────────────────────
import { WelcomePlugin } from './welcome/index.js'
import { PointsPlugin } from './points/index.js'
import { ContentFilterPlugin } from './content-filter/index.js'
import { RemindersPlugin } from './reminders/index.js'
import { KeywordReplyPlugin } from './keyword-reply/index.js'
import { RoleClaimPlugin } from './role-claim/index.js'
import { StatisticsPlugin } from './statistics/index.js'
import { AudioPlayerPlugin } from './audio-player/index.js'
import { ModerationPlugin } from './moderation/index.js'
import { VoicePointsPlugin } from './voice-points/index.js'
import { LevelPlugin } from './levels/index.js'
import { TicketPlugin } from './ticket/index.js'
import { EventsPlugin } from './events/index.js'
import { RafflePlugin } from './raffle/index.js'
import { PollsPlugin } from './polls/index.js'
import { QuestsPlugin } from './quests/index.js'
import { AnnouncerPlugin } from './announcer/index.js'
import { AntiSpamPlugin } from './anti-spam/index.js'

/**
 * 返回所有已注册插件的实例列表
 */
export function getAllPlugins(): IPlugin[] {
  return [
    new WelcomePlugin(),
    new PointsPlugin(),
    new ContentFilterPlugin(),
    new RemindersPlugin(),
    new KeywordReplyPlugin(),
    new RoleClaimPlugin(),
    new StatisticsPlugin(),
    new AudioPlayerPlugin(),
    new ModerationPlugin(),
    new VoicePointsPlugin(),
    new LevelPlugin(),
    new TicketPlugin(),
    new EventsPlugin(),
    new RafflePlugin(),
    new PollsPlugin(),
    new QuestsPlugin(),
    new AnnouncerPlugin(),
    new AntiSpamPlugin(),
  ]
}
