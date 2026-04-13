import { mysqlTable, varchar, int, timestamp, unique, index } from 'drizzle-orm/mysql-core'

export const pluginVoiceOnlineRecords = mysqlTable('plugin_voice_online_records', {
  id:              int('id').primaryKey().autoincrement(),
  tenantId:        varchar('tenant_id', { length: 36 }).notNull(),
  userId:          varchar('user_id', { length: 32 }).notNull(),
  guildId:         varchar('guild_id', { length: 32 }).notNull(),
  channelId:       varchar('channel_id', { length: 32 }).notNull(),
  joinTime:        timestamp('join_time').notNull(),
  leaveTime:       timestamp('leave_time'),
  durationSeconds: int('duration_seconds').default(0),
  pointsAwarded:   int('points_awarded').default(0),
  createdAt:       timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
  idxTenantUser:  index('idx_tenant_user').on(t.tenantId, t.userId),
}))

export const pluginVoicePointsDaily = mysqlTable('plugin_voice_points_daily', {
  id:           int('id').primaryKey().autoincrement(),
  tenantId:     varchar('tenant_id', { length: 36 }).notNull(),
  userId:       varchar('user_id', { length: 32 }).notNull(),
  guildId:      varchar('guild_id', { length: 32 }).notNull(),
  date:         varchar('date', { length: 10 }).notNull(),
  totalSeconds: int('total_seconds').default(0),
  pointsEarned: int('points_earned').default(0),
}, (t) => ({
  uniq:    unique().on(t.tenantId, t.userId, t.guildId, t.date),
  idxDate: index('idx_date').on(t.tenantId, t.date),
}))
