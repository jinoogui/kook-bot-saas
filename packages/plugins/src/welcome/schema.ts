import { mysqlTable, varchar, int, timestamp, text, uniqueIndex } from 'drizzle-orm/mysql-core'

export const pluginWelcomeMessages = mysqlTable('plugin_welcome_messages', {
  id:          int('id').primaryKey().autoincrement(),
  tenantId:    varchar('tenant_id', { length: 36 }).notNull(),
  guildId:     varchar('guild_id', { length: 32 }).notNull(),
  content:     text('content'),
  channelId:   varchar('channel_id', { length: 32 }),
  enabled:     int('enabled').default(1),
  messageType: varchar('message_type', { length: 16 }).default('kmarkdown'),
  cardContent: text('card_content'),
  updatedAt:   timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  uniqTenantGuild: uniqueIndex('uniq_tenant_guild').on(t.tenantId, t.guildId),
}))
