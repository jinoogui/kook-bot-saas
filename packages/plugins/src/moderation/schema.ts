import { mysqlTable, varchar, int, timestamp, text, index } from 'drizzle-orm/mysql-core'

export const pluginModerationBans = mysqlTable('plugin_moderation_bans', {
  id:       int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  userId:   varchar('user_id', { length: 32 }).notNull(),
  guildId:  varchar('guild_id', { length: 32 }).notNull(),
  reason:   varchar('reason', { length: 255 }),
  bannedBy: varchar('banned_by', { length: 32 }),
  bannedAt: timestamp('banned_at').defaultNow(),
}, (t) => ({
  idxTenantGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
  idxTenantUserGuild: index('idx_tenant_user_guild').on(t.tenantId, t.userId, t.guildId),
}))

export const pluginModerationMutes = mysqlTable('plugin_moderation_mutes', {
  id:        int('id').primaryKey().autoincrement(),
  tenantId:  varchar('tenant_id', { length: 36 }).notNull(),
  userId:    varchar('user_id', { length: 32 }).notNull(),
  guildId:   varchar('guild_id', { length: 32 }).notNull(),
  muteUntil: timestamp('mute_until').notNull(),
  mutedBy:   varchar('muted_by', { length: 32 }),
  mutedAt:   timestamp('muted_at').defaultNow(),
}, (t) => ({
  idxTenantGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
  idxTenantUserGuild: index('idx_tenant_user_guild').on(t.tenantId, t.userId, t.guildId),
}))

export const pluginModerationAds = mysqlTable('plugin_moderation_ads', {
  id:        int('id').primaryKey().autoincrement(),
  tenantId:  varchar('tenant_id', { length: 36 }).notNull(),
  guildId:   varchar('guild_id', { length: 32 }).notNull(),
  keyword:   varchar('keyword', { length: 256 }).notNull(),
  enabled:   int('enabled').default(1),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
}))
