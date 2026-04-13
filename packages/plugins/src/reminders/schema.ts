import { mysqlTable, varchar, int, timestamp, text, index } from 'drizzle-orm/mysql-core'

export const pluginReminders = mysqlTable('plugin_reminders', {
  id:        int('id').primaryKey().autoincrement(),
  tenantId:  varchar('tenant_id', { length: 36 }).notNull(),
  userId:    varchar('user_id', { length: 32 }).notNull(),
  guildId:   varchar('guild_id', { length: 32 }).notNull(),
  channelId: varchar('channel_id', { length: 32 }).notNull(),
  content:   text('content').notNull(),
  remindAt:  timestamp('remind_at').notNull(),
  sent:      int('sent').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxRemindAt: index('idx_tenant_remind_at').on(t.tenantId, t.remindAt),
}))
