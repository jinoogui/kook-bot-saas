import { mysqlTable, varchar, int, timestamp, text, boolean, index, unique, json } from 'drizzle-orm/mysql-core'

// ═══════════════════════════════════════════════════
//  平台用户
// ═══════════════════════════════════════════════════

export const platformUsers = mysqlTable('platform_users', {
  id: int('id').primaryKey().autoincrement(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 64 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 16 }).notNull().default('user'), // user | admin
  status: varchar('status', { length: 16 }).notNull().default('active'), // active | suspended | deleted
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
})

// ═══════════════════════════════════════════════════
//  租户（Bot 实例）
// ═══════════════════════════════════════════════════

export const tenants = mysqlTable('tenants', {
  id: varchar('id', { length: 36 }).primaryKey(), // UUID
  userId: int('user_id').notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  botToken: text('bot_token').notNull(), // 加密存储
  verifyToken: varchar('verify_token', { length: 128 }),
  encryptKey: varchar('encrypt_key', { length: 64 }),
  assignedPort: int('assigned_port'),
  status: varchar('status', { length: 16 }).notNull().default('stopped'), // stopped | starting | running | error
  pid: int('pid'),
  lastHeartbeat: timestamp('last_heartbeat'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  idxUserId: index('idx_user_id').on(t.userId),
}))

// ═══════════════════════════════════════════════════
//  插件目录
// ═══════════════════════════════════════════════════

export const pluginCatalog = mysqlTable('plugin_catalog', {
  id: varchar('id', { length: 64 }).primaryKey(), // 插件 ID，如 'points', 'welcome'
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 32 }).notNull(),
  tier: varchar('tier', { length: 16 }).notNull().default('free'), // free | paid
  priceMonthly: int('price_monthly').default(0), // 分为单位
  priceYearly: int('price_yearly').default(0),
  dependencies: text('dependencies'), // JSON array of plugin IDs
  version: varchar('version', { length: 32 }).notNull().default('1.0.0'),
  configSchema: text('config_schema'), // JSON Schema for plugin configuration
  enabled: int('enabled').default(1), // int used as boolean (0/1) for MySQL compatibility
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
})

// ═══════════════════════════════════════════════════
//  插件订阅
// ═══════════════════════════════════════════════════

export const subscriptions = mysqlTable('subscriptions', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  pluginId: varchar('plugin_id', { length: 64 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'), // active | expired | cancelled
  planType: varchar('plan_type', { length: 16 }).notNull().default('monthly'), // monthly | yearly | lifetime
  startedAt: timestamp('started_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
  isEnabled: int('is_enabled').default(1), // int used as boolean (0/1) for MySQL compatibility — 用户可手动禁用
  configJson: text('config_json'), // 插件的用户自定义配置
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  uniqSub: unique().on(t.tenantId, t.pluginId),
  idxTenant: index('idx_tenant').on(t.tenantId),
}))

// ═══════════════════════════════════════════════════
//  支付记录
// ═══════════════════════════════════════════════════

export const payments = mysqlTable('payments', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  pluginId: varchar('plugin_id', { length: 64 }).notNull(),
  amount: int('amount').notNull(), // 分为单位
  provider: varchar('provider', { length: 32 }), // wechat | alipay | manual
  status: varchar('status', { length: 16 }).notNull().default('pending'), // pending | paid | refunded | failed
  riskDecision: varchar('risk_decision', { length: 16 }).notNull().default('pass'), // pass | review | reject
  riskReason: text('risk_reason'),
  riskCheckedAt: timestamp('risk_checked_at'),
  externalOrderId: varchar('external_order_id', { length: 128 }),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxUser: index('idx_user').on(t.userId),
  idxTenant: index('idx_tenant').on(t.tenantId),
  idxRiskDecisionCreated: index('idx_risk_decision_created').on(t.riskDecision, t.createdAt),
}))

// ═══════════════════════════════════════════════════
//  实例日志
// ═══════════════════════════════════════════════════

export const instanceLogs = mysqlTable('instance_logs', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  level: varchar('level', { length: 8 }).notNull().default('info'), // info | warn | error
  message: text('message').notNull(),
  metadata: text('metadata'), // JSON
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxTenant: index('idx_tenant').on(t.tenantId),
  idxCreated: index('idx_created').on(t.createdAt),
}))

// ═══════════════════════════════════════════════════
//  审计日志
// ═══════════════════════════════════════════════════

export const auditLogs = mysqlTable('audit_logs', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  action: varchar('action', { length: 64 }).notNull(), // e.g. tenant.create, instance.start
  resource: varchar('resource', { length: 32 }).notNull(), // e.g. tenant, instance, subscription
  resourceId: varchar('resource_id', { length: 128 }),
  details: text('details'), // JSON 详情
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  idxUserId: index('idx_audit_user').on(t.userId),
  idxAction: index('idx_audit_action').on(t.action),
  idxCreatedAt: index('idx_audit_created').on(t.createdAt),
}))
