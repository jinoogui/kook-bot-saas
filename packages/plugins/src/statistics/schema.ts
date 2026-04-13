import { mysqlTable, varchar, int, timestamp, date, index } from 'drizzle-orm/mysql-core'

export const pluginStatsActivityStats = mysqlTable('plugin_stats_activity_stats', {
  id:           int('id').primaryKey().autoincrement(),
  tenantId:     varchar('tenant_id', { length: 36 }).notNull(),
  guildId:      varchar('guild_id', { length: 32 }).notNull(),
  channelId:    varchar('channel_id', { length: 32 }),
  statDate:     date('stat_date').notNull(),
  statHour:     int('stat_hour').notNull(),
  messageCount: int('message_count').default(0),
  uniqueUsers:  int('unique_users').default(0),
}, (t) => ({
  idxTenantGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
}))

export const pluginStatsOnlineStats = mysqlTable('plugin_stats_online_stats', {
  id:          int('id').primaryKey().autoincrement(),
  tenantId:    varchar('tenant_id', { length: 36 }).notNull(),
  guildId:     varchar('guild_id', { length: 32 }).notNull(),
  timestamp:   timestamp('timestamp').notNull(),
  onlineCount: int('online_count').default(0),
}, (t) => ({
  idxTenantGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
}))

export const pluginStatsUserActivity = mysqlTable('plugin_stats_user_activity', {
  id:           int('id').primaryKey().autoincrement(),
  tenantId:     varchar('tenant_id', { length: 36 }).notNull(),
  userId:       varchar('user_id', { length: 32 }).notNull(),
  guildId:      varchar('guild_id', { length: 32 }).notNull(),
  messageCount: int('message_count').default(0),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
}, (t) => ({
  idxTenantGuild: index('idx_tenant_guild_user').on(t.tenantId, t.guildId, t.userId),
}))
