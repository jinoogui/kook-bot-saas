import { mysqlTable, varchar, int, timestamp, text, index } from 'drizzle-orm/mysql-core'

export const pluginFilterAds = mysqlTable('plugin_filter_ads', {
  id:        int('id').primaryKey().autoincrement(),
  tenantId:  varchar('tenant_id', { length: 36 }).notNull(),
  guildId:   varchar('guild_id', { length: 32 }).notNull(),
  keyword:   varchar('keyword', { length: 256 }).notNull(),
  enabled:   int('enabled').default(1),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
}))

export const pluginFilterViolationRecords = mysqlTable('plugin_filter_violation_records', {
  id:        int('id').primaryKey().autoincrement(),
  tenantId:  varchar('tenant_id', { length: 36 }).notNull(),
  userId:    varchar('user_id', { length: 32 }).notNull(),
  guildId:   varchar('guild_id', { length: 32 }).notNull(),
  type:      varchar('type', { length: 32 }).notNull(),
  content:   text('content'),
  channelId: varchar('channel_id', { length: 32 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantUser: index('idx_tenant_user').on(t.tenantId, t.userId, t.guildId),
}))
