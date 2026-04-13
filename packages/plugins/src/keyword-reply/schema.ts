import { mysqlTable, varchar, int, timestamp, text, index } from 'drizzle-orm/mysql-core'

export const pluginKeywordReplies = mysqlTable('plugin_keyword_replies', {
  id:        int('id').primaryKey().autoincrement(),
  tenantId:  varchar('tenant_id', { length: 36 }).notNull(),
  guildId:   varchar('guild_id', { length: 32 }).notNull(),
  keyword:   varchar('keyword', { length: 256 }).notNull(),
  reply:     text('reply').notNull(),
  matchType: varchar('match_type', { length: 16 }).default('contains'),
  enabled:   int('enabled').default(1),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
}))

export const pluginAutoReplies = mysqlTable('plugin_auto_replies', {
  id:        int('id').primaryKey().autoincrement(),
  tenantId:  varchar('tenant_id', { length: 36 }).notNull(),
  guildId:   varchar('guild_id', { length: 32 }).notNull(),
  trigger:   varchar('trigger', { length: 256 }).notNull(),
  response:  text('response').notNull(),
  enabled:   int('enabled').default(1),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
}))
