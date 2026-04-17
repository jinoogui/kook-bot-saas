import { mysqlTable, varchar, int, timestamp, text, index, unique } from 'drizzle-orm/mysql-core'

export const pluginTicketTickets = mysqlTable('plugin_ticket_tickets', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  channelId: varchar('channel_id', { length: 32 }),
  messageId: varchar('message_id', { length: 32 }),
  creatorUserId: varchar('creator_user_id', { length: 32 }).notNull(),
  assigneeUserId: varchar('assignee_user_id', { length: 32 }),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content'),
  priority: varchar('priority', { length: 16 }).notNull().default('normal'),
  status: varchar('status', { length: 16 }).notNull().default('open'),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  idxTenantGuildStatus: index('idx_tenant_guild_status').on(t.tenantId, t.guildId, t.status),
  idxTenantCreator: index('idx_tenant_creator').on(t.tenantId, t.creatorUserId),
}))

export const pluginTicketLogs = mysqlTable('plugin_ticket_logs', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  ticketId: int('ticket_id').notNull(),
  action: varchar('action', { length: 32 }).notNull(),
  operatorUserId: varchar('operator_user_id', { length: 32 }).notNull(),
  detail: text('detail'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantTicket: index('idx_tenant_ticket').on(t.tenantId, t.ticketId),
}))

export const pluginEventsItems = mysqlTable('plugin_events_items', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  channelId: varchar('channel_id', { length: 32 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  startAt: timestamp('start_at').notNull(),
  endAt: timestamp('end_at').notNull(),
  maxParticipants: int('max_participants').default(0),
  status: varchar('status', { length: 16 }).notNull().default('draft'),
  reminderSent: int('reminder_sent').default(0),
  createdBy: varchar('created_by', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  idxTenantGuildStatus: index('idx_events_tenant_guild_status').on(t.tenantId, t.guildId, t.status),
  idxTenantStart: index('idx_events_tenant_start').on(t.tenantId, t.startAt),
}))

export const pluginEventsParticipants = mysqlTable('plugin_events_participants', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  eventId: int('event_id').notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  userId: varchar('user_id', { length: 32 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('joined'),
  joinedAt: timestamp('joined_at').defaultNow(),
}, (t) => ({
  uniqTenantEventUser: unique().on(t.tenantId, t.eventId, t.userId),
  idxTenantGuild: index('idx_events_participant_tenant_guild').on(t.tenantId, t.guildId),
}))

export const pluginRaffleItems = mysqlTable('plugin_raffle_items', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  channelId: varchar('channel_id', { length: 32 }).notNull(),
  messageId: varchar('message_id', { length: 32 }),
  title: varchar('title', { length: 200 }).notNull(),
  prize: varchar('prize', { length: 255 }).notNull(),
  drawAt: timestamp('draw_at').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('open'),
  winnerUserId: varchar('winner_user_id', { length: 32 }),
  createdBy: varchar('created_by', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantGuildStatus: index('idx_raffle_tenant_guild_status').on(t.tenantId, t.guildId, t.status),
  idxTenantDrawAt: index('idx_raffle_tenant_draw_at').on(t.tenantId, t.drawAt),
}))

export const pluginRaffleParticipants = mysqlTable('plugin_raffle_participants', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  raffleId: int('raffle_id').notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  userId: varchar('user_id', { length: 32 }).notNull(),
  joinedAt: timestamp('joined_at').defaultNow(),
}, (t) => ({
  uniqTenantRaffleUser: unique().on(t.tenantId, t.raffleId, t.userId),
  idxTenantRaffle: index('idx_raffle_participant_tenant_raffle').on(t.tenantId, t.raffleId),
}))

export const pluginQuestsTemplates = mysqlTable('plugin_quests_templates', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  code: varchar('code', { length: 64 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  targetCount: int('target_count').notNull().default(10),
  rewardPoints: int('reward_points').notNull().default(10),
  enabled: int('enabled').default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  uniqTenantGuildCode: unique().on(t.tenantId, t.guildId, t.code),
  idxTenantGuildEnabled: index('idx_quest_template_tenant_guild_enabled').on(t.tenantId, t.guildId, t.enabled),
}))

export const pluginQuestsProgress = mysqlTable('plugin_quests_progress', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  userId: varchar('user_id', { length: 32 }).notNull(),
  questCode: varchar('quest_code', { length: 64 }).notNull(),
  dateKey: varchar('date_key', { length: 10 }).notNull(),
  progress: int('progress').notNull().default(0),
  claimed: int('claimed').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  uniqTenantGuildUserQuestDate: unique().on(t.tenantId, t.guildId, t.userId, t.questCode, t.dateKey),
  idxTenantGuildDate: index('idx_quest_progress_tenant_guild_date').on(t.tenantId, t.guildId, t.dateKey),
}))

export const pluginAnnouncerTasks = mysqlTable('plugin_announcer_tasks', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  channelId: varchar('channel_id', { length: 32 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  scheduleAt: timestamp('schedule_at').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('scheduled'),
  retryCount: int('retry_count').notNull().default(0),
  lastError: text('last_error'),
  createdBy: varchar('created_by', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  idxTenantGuildStatus: index('idx_announcer_tenant_guild_status').on(t.tenantId, t.guildId, t.status),
  idxTenantSchedule: index('idx_announcer_tenant_schedule').on(t.tenantId, t.scheduleAt),
}))

export const pluginPollsItems = mysqlTable('plugin_polls_items', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  channelId: varchar('channel_id', { length: 32 }).notNull(),
  messageId: varchar('message_id', { length: 32 }),
  title: varchar('title', { length: 255 }).notNull(),
  optionsJson: text('options_json').notNull(),
  allowMulti: int('allow_multi').default(0),
  status: varchar('status', { length: 16 }).notNull().default('open'),
  endsAt: timestamp('ends_at'),
  createdBy: varchar('created_by', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantGuildStatus: index('idx_polls_tenant_guild_status').on(t.tenantId, t.guildId, t.status),
  idxTenantEndsAt: index('idx_polls_tenant_ends_at').on(t.tenantId, t.endsAt),
}))

export const pluginPollsVotes = mysqlTable('plugin_polls_votes', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  pollId: int('poll_id').notNull(),
  userId: varchar('user_id', { length: 32 }).notNull(),
  optionKey: varchar('option_key', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantPoll: index('idx_polls_vote_tenant_poll').on(t.tenantId, t.pollId),
  uniqTenantPollUserOption: unique().on(t.tenantId, t.pollId, t.userId, t.optionKey),
}))

export const pluginAntiSpamRules = mysqlTable('plugin_anti_spam_rules', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  enabled: int('enabled').default(1),
  maxMessagesPerWindow: int('max_messages_per_window').notNull().default(6),
  windowSeconds: int('window_seconds').notNull().default(10),
  duplicateThreshold: int('duplicate_threshold').notNull().default(3),
  blockAtAll: int('block_at_all').notNull().default(1),
  actionType: varchar('action_type', { length: 16 }).notNull().default('warn'),
  muteHours: int('mute_hours').notNull().default(1),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  uniqTenantGuild: unique().on(t.tenantId, t.guildId),
}))

export const pluginAntiSpamViolations = mysqlTable('plugin_anti_spam_violations', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  userId: varchar('user_id', { length: 32 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  content: text('content'),
  actionTaken: varchar('action_taken', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantGuildUser: index('idx_antis_spam_tenant_guild_user').on(t.tenantId, t.guildId, t.userId),
}))

export const pluginAntiSpamWhitelist = mysqlTable('plugin_anti_spam_whitelist', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  userId: varchar('user_id', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  uniqTenantGuildUser: unique().on(t.tenantId, t.guildId, t.userId),
  idxTenantGuild: index('idx_antis_spam_whitelist_tenant_guild').on(t.tenantId, t.guildId),
}))
