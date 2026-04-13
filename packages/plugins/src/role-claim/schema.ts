import { mysqlTable, varchar, int, timestamp, index } from 'drizzle-orm/mysql-core'

export const pluginRoleClaimConfigs = mysqlTable('plugin_role_claim_configs', {
  id:        int('id').primaryKey().autoincrement(),
  tenantId:  varchar('tenant_id', { length: 36 }).notNull(),
  guildId:   varchar('guild_id', { length: 32 }).notNull(),
  channelId: varchar('channel_id', { length: 32 }).notNull(),
  messageId: varchar('message_id', { length: 32 }),
  roleId:    varchar('role_id', { length: 32 }).notNull(),
  emoji:     varchar('emoji', { length: 64 }),
  label:     varchar('label', { length: 128 }),
  enabled:   int('enabled').default(1),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
}))
