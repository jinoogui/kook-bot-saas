import { mysqlTable, varchar, int, timestamp, unique, index } from 'drizzle-orm/mysql-core'

export const pluginLevelsUserActivity = mysqlTable('plugin_levels_user_activity', {
  id:           int('id').primaryKey().autoincrement(),
  tenantId:     varchar('tenant_id', { length: 36 }).notNull(),
  userId:       varchar('user_id', { length: 32 }).notNull(),
  guildId:      varchar('guild_id', { length: 32 }).notNull(),
  messageCount: int('message_count').default(0),
  totalXp:      int('total_xp').default(0),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
}, (t) => ({
  uniq:          unique().on(t.tenantId, t.userId, t.guildId),
  idxTenantGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
}))

export const pluginLevelsConfigs = mysqlTable('plugin_levels_configs', {
  id:             int('id').primaryKey().autoincrement(),
  tenantId:       varchar('tenant_id', { length: 36 }).notNull(),
  guildId:        varchar('guild_id', { length: 32 }).notNull(),
  xpPerMessage:   int('xp_per_message').default(10),
  xpCooldown:     int('xp_cooldown').default(60),
  levelUpChannel: varchar('level_up_channel', { length: 32 }),
  enabled:        int('enabled').default(0),
  updatedAt:      timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  uniq: unique().on(t.tenantId, t.guildId),
}))
