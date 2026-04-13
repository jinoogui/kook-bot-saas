import { mysqlTable, varchar, int, timestamp, text, unique, index } from 'drizzle-orm/mysql-core'

export const pluginPointsCheckinRecords = mysqlTable('plugin_points_checkin_records', {
  id:          int('id').primaryKey().autoincrement(),
  tenantId:    varchar('tenant_id', { length: 36 }).notNull(),
  userId:      varchar('user_id', { length: 32 }).notNull(),
  guildId:     varchar('guild_id', { length: 32 }).notNull(),
  checkinDate: varchar('checkin_date', { length: 10 }).notNull(),
  points:      int('points').notNull().default(0),
  streakDays:  int('streak_days').default(1),
  bonusPoints: int('bonus_points').default(0),
  createdAt:   timestamp('created_at').defaultNow(),
}, (t) => ({
  uniq:     unique().on(t.tenantId, t.userId, t.guildId, t.checkinDate),
  idxGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
}))

export const pluginPointsUserPoints = mysqlTable('plugin_points_user_points', {
  id:          int('id').primaryKey().autoincrement(),
  tenantId:    varchar('tenant_id', { length: 36 }).notNull(),
  userId:      varchar('user_id', { length: 32 }).notNull(),
  guildId:     varchar('guild_id', { length: 32 }).notNull(),
  points:      int('points').notNull().default(0),
  totalEarned: int('total_earned').notNull().default(0),
  updatedAt:   timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  uniq:     unique().on(t.tenantId, t.userId, t.guildId),
  idxGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
}))

export const pluginPointsShopItems = mysqlTable('plugin_points_shop_items', {
  id:          int('id').primaryKey().autoincrement(),
  tenantId:    varchar('tenant_id', { length: 36 }).notNull(),
  guildId:     varchar('guild_id', { length: 32 }).notNull(),
  name:        varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  price:       int('price').notNull(),
  roleId:      varchar('role_id', { length: 32 }),
  stock:       int('stock').default(-1),
  enabled:     int('enabled').default(1),
  createdAt:   timestamp('created_at').defaultNow(),
}, (t) => ({
  idxGuild: index('idx_tenant_guild').on(t.tenantId, t.guildId),
}))

export const pluginPointsShopExchanges = mysqlTable('plugin_points_shop_exchanges', {
  id:        int('id').primaryKey().autoincrement(),
  tenantId:  varchar('tenant_id', { length: 36 }).notNull(),
  userId:    varchar('user_id', { length: 32 }).notNull(),
  guildId:   varchar('guild_id', { length: 32 }).notNull(),
  itemId:    int('item_id').notNull(),
  itemName:  varchar('item_name', { length: 128 }).notNull(),
  itemPrice: int('item_price').notNull(),
  confirmed: int('confirmed').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenantUserGuild: index('idx_tenant_user_guild').on(t.tenantId, t.userId, t.guildId),
}))

export const pluginPointsRewardRecords = mysqlTable('plugin_points_reward_records', {
  id:           int('id').primaryKey().autoincrement(),
  tenantId:     varchar('tenant_id', { length: 36 }).notNull(),
  userId:       varchar('user_id', { length: 32 }).notNull(),
  guildId:      varchar('guild_id', { length: 32 }).notNull(),
  rewardType:   varchar('reward_type', { length: 32 }).notNull(),
  rewardName:   varchar('reward_name', { length: 128 }),
  pointsEarned: int('points_earned').notNull().default(0),
  createdAt:    timestamp('created_at').defaultNow(),
}, (t) => ({
  idxUser: index('idx_tenant_user').on(t.tenantId, t.userId, t.guildId),
}))

export const pluginPointsBoxRewardConfigs = mysqlTable('plugin_points_box_reward_configs', {
  id:        int('id').primaryKey().autoincrement(),
  tenantId:  varchar('tenant_id', { length: 36 }).notNull(),
  guildId:   varchar('guild_id', { length: 32 }).notNull(),
  minPoints: int('min_points').notNull().default(1),
  maxPoints: int('max_points').notNull().default(10),
  cooldown:  int('cooldown').default(3600),
  enabled:   int('enabled').default(1),
}, (t) => ({
  uniq: unique().on(t.tenantId, t.guildId),
}))
