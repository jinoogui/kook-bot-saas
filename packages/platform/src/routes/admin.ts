import type { FastifyInstance } from 'fastify'
import { eq, sql, count, and, or, like, gte, lte, desc, inArray } from 'drizzle-orm'
import type { PlatformDB } from '../db/index.js'
import type { InstanceManager } from '../services/InstanceService.js'
import type { TenantService } from '../services/TenantService.js'
import type { AuditService } from '../services/AuditService.js'
import type { SubscriptionService } from '../services/SubscriptionService.js'
import { SubscriptionError } from '../services/SubscriptionService.js'
import {
  platformUsers,
  tenants,
  pluginCatalog,
  subscriptions,
  payments,
  auditLogs,
} from '../db/schema/index.js'

interface AdminDeps {
  db: PlatformDB
  instanceManager: InstanceManager
  tenantService: TenantService
  auditService?: AuditService
  subscriptionService?: SubscriptionService
}

function sendError(reply: any, statusCode: number, code: string, error: string) {
  return reply.code(statusCode).send({ success: false, code, error })
}

function parsePage(query: any) {
  const pageNum = Math.max(1, parseInt(query?.page ?? '1', 10) || 1)
  const sizeNum = Math.min(100, Math.max(1, parseInt(query?.size ?? '20', 10) || 20))
  const offset = (pageNum - 1) * sizeNum
  return { pageNum, sizeNum, offset }
}

function parseDateRange(startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null
  if (start && Number.isNaN(start.getTime())) return { start: null, end: null, invalid: true }
  if (end && Number.isNaN(end.getTime())) return { start: null, end: null, invalid: true }
  if (start) start.setHours(0, 0, 0, 0)
  if (end) end.setHours(23, 59, 59, 999)
  return { start, end, invalid: false }
}

const EXPORT_SYNC_LIMIT = (() => {
  const parsed = Number.parseInt(process.env.EXPORT_SYNC_LIMIT ?? '5000', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 5000
  return parsed
})()

function normalizeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function csvEscape(value: unknown): string {
  const text = normalizeCsvValue(value)
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','))
  }
  return `\uFEFF${lines.join('\n')}`
}

function formatDateTime(value: unknown): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toISOString()
}

function makeExportFilename(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${prefix}-${stamp}.csv`
}

export function registerAdminRoutes(app: FastifyInstance, deps: AdminDeps) {
  const { db, instanceManager, tenantService, auditService, subscriptionService } = deps
  const adminAuth = { preHandler: [app.requireAdmin] }

  // ═══════════════════════════════════════════════════
  //  GET /api/admin/stats — 平台概览统计
  // ═══════════════════════════════════════════════════

  app.get('/api/admin/stats', adminAuth, async () => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    const last30DaysStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      [userCount],
      [tenantCount],
      [runningCount],
      [revenueResult],
      [todayRevenueResult],
      [pendingReviewCount],
      [riskRejectCount],
      [paidLast30Count],
      [failedLast30Count],
    ] = await Promise.all([
      db.select({ value: count() }).from(platformUsers),
      db.select({ value: count() }).from(tenants),
      db.select({ value: count() }).from(tenants).where(eq(tenants.status, 'running')),
      db.select({ value: sql<number>`COALESCE(SUM(amount), 0)` }).from(payments).where(eq(payments.status, 'paid')),
      db
        .select({ value: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(payments)
        .where(and(
          eq(payments.status, 'paid'),
          gte(payments.paidAt, todayStart),
          lte(payments.paidAt, todayEnd),
        )),
      db
        .select({ value: count() })
        .from(payments)
        .where(and(
          eq(payments.riskDecision, 'review'),
          eq(payments.status, 'pending'),
        )),
      db
        .select({ value: count() })
        .from(payments)
        .where(eq(payments.riskDecision, 'reject')),
      db
        .select({ value: count() })
        .from(payments)
        .where(and(
          eq(payments.status, 'paid'),
          gte(payments.createdAt, last30DaysStart),
        )),
      db
        .select({ value: count() })
        .from(payments)
        .where(and(
          eq(payments.status, 'failed'),
          gte(payments.createdAt, last30DaysStart),
        )),
    ])

    const paidLast30 = paidLast30Count.value
    const failedLast30 = failedLast30Count.value
    const denominator = paidLast30 + failedLast30

    return {
      success: true,
      data: {
        userCount: userCount.value,
        tenantCount: tenantCount.value,
        runningCount: runningCount.value,
        totalRevenue: revenueResult.value,
        todayRevenue: todayRevenueResult.value,
        pendingReviewCount: pendingReviewCount.value,
        riskRejectCount: riskRejectCount.value,
        payConversion: denominator > 0 ? Number((paidLast30 / denominator).toFixed(4)) : 0,
      },
    }
  })

  // ═══════════════════════════════════════════════════
  //  GET /api/admin/users — 用户列表
  // ═══════════════════════════════════════════════════

  app.get('/api/admin/users', adminAuth, async (request, reply) => {
    const { role, status, keyword, startDate, endDate } = request.query as any
    const { pageNum, sizeNum, offset } = parsePage(request.query as any)
    const { start, end, invalid } = parseDateRange(startDate, endDate)
    if (invalid) return sendError(reply, 400, 'INVALID_DATE_RANGE', '无效的日期范围')

    const conditions = [] as any[]
    if (role && ['user', 'admin'].includes(role)) conditions.push(eq(platformUsers.role, role))
    if (status && ['active', 'suspended', 'deleted'].includes(status)) conditions.push(eq(platformUsers.status, status))
    if (keyword) {
      conditions.push(or(
        like(platformUsers.email, `%${keyword}%`),
        like(platformUsers.username, `%${keyword}%`),
      ))
    }
    if (start) conditions.push(gte(platformUsers.createdAt, start))
    if (end) conditions.push(lte(platformUsers.createdAt, end))

    const whereExpr = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: platformUsers.id,
          email: platformUsers.email,
          username: platformUsers.username,
          role: platformUsers.role,
          status: platformUsers.status,
          createdAt: platformUsers.createdAt,
        })
        .from(platformUsers)
        .where(whereExpr)
        .orderBy(desc(platformUsers.createdAt))
        .limit(sizeNum)
        .offset(offset),
      db.select({ value: count() }).from(platformUsers).where(whereExpr),
    ])

    return { success: true, data: { rows, total: total.value, page: pageNum, size: sizeNum } }
  })

  // ═══════════════════════════════════════════════════
  //  PATCH /api/admin/users/:id — 修改用户状态/角色
  // ═══════════════════════════════════════════════════

  app.patch('/api/admin/users/:id', adminAuth, async (request, reply) => {
    const { id } = request.params as any
    const { role, status } = request.body as any

    const numId = parseInt(id, 10)
    if (!Number.isInteger(numId) || numId <= 0) {
      return sendError(reply, 400, 'INVALID_USER_ID', '无效的用户 ID')
    }
    // Prevent admin from modifying their own role
    const { userId } = request.user as any
    if (role && numId === userId) {
      return sendError(reply, 400, 'CANNOT_UPDATE_SELF_ROLE', '不能修改自己的角色')
    }

    const updates: Record<string, any> = {}
    if (role && ['user', 'admin'].includes(role)) updates.role = role
    if (status && ['active', 'suspended', 'deleted'].includes(status)) updates.status = status

    if (Object.keys(updates).length === 0) {
      return sendError(reply, 400, 'NO_VALID_UPDATE_FIELDS', '无有效更新字段')
    }

    await db.update(platformUsers).set(updates).where(eq(platformUsers.id, numId))
    await auditService?.log({
      userId, action: role ? 'user.role_change' : 'user.status_change', resource: 'user',
      resourceId: String(numId), details: updates, ipAddress: request.ip,
    })
    return { success: true, message: '更新成功' }
  })

  // ═══════════════════════════════════════════════════
  //  POST /api/admin/users/batch — 批量用户操作
  // ═══════════════════════════════════════════════════

  app.post('/api/admin/users/batch', adminAuth, async (request, reply) => {
    const { ids, role, status } = request.body as any
    if (!Array.isArray(ids) || ids.length === 0) {
      return sendError(reply, 400, 'INVALID_USER_IDS', '请提供用户 ID 列表')
    }

    const updates: Record<string, any> = {}
    if (role && ['user', 'admin'].includes(role)) updates.role = role
    if (status && ['active', 'suspended', 'deleted'].includes(status)) updates.status = status
    if (Object.keys(updates).length === 0) {
      return sendError(reply, 400, 'NO_VALID_UPDATE_FIELDS', '无有效更新字段')
    }

    const numIds = Array.from(new Set(ids.map((v: any) => parseInt(v, 10)).filter((v: number) => Number.isInteger(v) && v > 0)))
    if (numIds.length === 0) {
      return sendError(reply, 400, 'INVALID_USER_IDS', '用户 ID 列表无效')
    }

    const { userId } = request.user as any
    if (role && numIds.includes(userId)) {
      return sendError(reply, 400, 'CANNOT_UPDATE_SELF_ROLE', '不能批量修改自己的角色')
    }

    const result = await db
      .update(platformUsers)
      .set(updates)
      .where(inArray(platformUsers.id, numIds))

    await auditService?.log({
      userId,
      action: role ? 'user.batch_role_change' : 'user.batch_status_change',
      resource: 'user',
      resourceId: numIds.join(','),
      details: { ids: numIds, updates, affectedRows: (result as any)?.affectedRows ?? 0 },
      ipAddress: request.ip,
    })

    return {
      success: true,
      data: {
        affectedRows: (result as any)?.affectedRows ?? 0,
        ids: numIds,
        updates,
      },
    }
  })

  app.get('/api/admin/tenants', adminAuth, async (request, reply) => {
    const { status, keyword, ownerId, startDate, endDate } = request.query as any
    const { pageNum, sizeNum, offset } = parsePage(request.query as any)
    const { start, end, invalid } = parseDateRange(startDate, endDate)
    if (invalid) return sendError(reply, 400, 'INVALID_DATE_RANGE', '无效的日期范围')

    const conditions = [] as any[]
    if (status && ['running', 'stopped', 'error', 'starting', 'stopping'].includes(status)) {
      conditions.push(eq(tenants.status, status))
    }
    if (ownerId && Number.isInteger(parseInt(ownerId, 10))) {
      conditions.push(eq(tenants.userId, parseInt(ownerId, 10)))
    }
    if (keyword) {
      conditions.push(or(
        like(tenants.name, `%${keyword}%`),
        like(platformUsers.email, `%${keyword}%`),
        like(platformUsers.username, `%${keyword}%`),
      ))
    }
    if (start) conditions.push(gte(tenants.createdAt, start))
    if (end) conditions.push(lte(tenants.createdAt, end))

    const whereExpr = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: tenants.id,
          userId: tenants.userId,
          name: tenants.name,
          status: tenants.status,
          assignedPort: tenants.assignedPort,
          lastHeartbeat: tenants.lastHeartbeat,
          createdAt: tenants.createdAt,
          ownerEmail: platformUsers.email,
          ownerUsername: platformUsers.username,
        })
        .from(tenants)
        .leftJoin(platformUsers, eq(tenants.userId, platformUsers.id))
        .where(whereExpr)
        .orderBy(desc(tenants.createdAt))
        .limit(sizeNum)
        .offset(offset),
      db.select({ value: count() }).from(tenants).leftJoin(platformUsers, eq(tenants.userId, platformUsers.id)).where(whereExpr),
    ])

    return { success: true, data: { rows, total: total.value, page: pageNum, size: sizeNum } }
  })

  // ═══════════════════════════════════════════════════
  //  POST /api/admin/tenants/:id/stop — 强制停止
  // ═══════════════════════════════════════════════════

  app.post('/api/admin/tenants/:id/stop', adminAuth, async (request, reply) => {
    const { id } = request.params as any
    if (!id || typeof id !== 'string') {
      return sendError(reply, 400, 'INVALID_TENANT_ID', '无效的租户 ID')
    }
    try {
      await instanceManager.stopInstance(id)
      return { success: true, message: '实例已停止' }
    } catch (err: any) {
      return sendError(reply, 400, 'TENANT_STOP_FAILED', err?.message || '停止失败')
    }
  })

  // ═══════════════════════════════════════════════════
  //  POST /api/admin/tenants/:id/restart — 强制重启
  // ═══════════════════════════════════════════════════

  app.post('/api/admin/tenants/:id/restart', adminAuth, async (request, reply) => {
    const { id } = request.params as any
    if (!id || typeof id !== 'string') {
      return sendError(reply, 400, 'INVALID_TENANT_ID', '无效的租户 ID')
    }
    try {
      const info = await instanceManager.restartInstance(id)
      return { success: true, data: { tenantId: info.tenantId, pid: info.process.pid, status: info.status } }
    } catch (err: any) {
      return sendError(reply, 400, 'TENANT_RESTART_FAILED', err?.message || '重启失败')
    }
  })

  // ═══════════════════════════════════════════════════
  //  POST /api/admin/tenants/batch — 批量实例操作
  // ═══════════════════════════════════════════════════

  app.post('/api/admin/tenants/batch', adminAuth, async (request, reply) => {
    const { ids, action } = request.body as any
    if (!Array.isArray(ids) || ids.length === 0) {
      return sendError(reply, 400, 'INVALID_TENANT_IDS', '请提供租户 ID 列表')
    }
    if (!['stop', 'restart'].includes(action)) {
      return sendError(reply, 400, 'INVALID_TENANT_ACTION', '无效的批量实例操作')
    }

    const tenantIds = Array.from(new Set(ids.filter((v: any) => typeof v === 'string' && v.trim())))
    if (tenantIds.length === 0) {
      return sendError(reply, 400, 'INVALID_TENANT_IDS', '租户 ID 列表无效')
    }

    const results: Array<{ id: string; success: boolean; code?: string; error?: string }> = []
    for (const tenantId of tenantIds) {
      try {
        if (action === 'stop') await instanceManager.stopInstance(tenantId)
        else await instanceManager.restartInstance(tenantId)
        results.push({ id: tenantId, success: true })
      } catch (err: any) {
        results.push({ id: tenantId, success: false, code: 'TENANT_BATCH_ACTION_FAILED', error: err?.message || '批量实例操作失败' })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failedCount = results.length - successCount
    const { userId } = request.user as any
    await auditService?.log({
      userId,
      action: action === 'stop' ? 'tenant.batch_stop' : 'tenant.batch_restart',
      resource: 'tenant',
      resourceId: tenantIds.join(','),
      details: { ids: tenantIds, successCount, failedCount },
      ipAddress: request.ip,
    })

    return {
      success: true,
      data: {
        action,
        total: results.length,
        successCount,
        failedCount,
        results,
      },
    }
  })

  app.get('/api/admin/plugins', adminAuth, async () => {
    const rows = await db.select().from(pluginCatalog)
    return { success: true, data: rows }
  })

  // ═══════════════════════════════════════════════════
  //  PATCH /api/admin/plugins/:id — 修改插件
  // ═══════════════════════════════════════════════════

  app.patch('/api/admin/plugins/:id', adminAuth, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.priceMonthly !== undefined) updates.priceMonthly = Number(body.priceMonthly)
    if (body.priceYearly !== undefined) updates.priceYearly = Number(body.priceYearly)
    if (body.enabled !== undefined) updates.enabled = body.enabled ? 1 : 0
    if (body.tier !== undefined) {
      if (!['free', 'paid'].includes(body.tier)) {
        return sendError(reply, 400, 'INVALID_PLUGIN_TIER', 'tier 值无效')
      }
      updates.tier = body.tier
    }

    if (Object.keys(updates).length === 0) {
      return sendError(reply, 400, 'NO_VALID_UPDATE_FIELDS', '无有效更新字段')
    }

    await db.update(pluginCatalog).set(updates).where(eq(pluginCatalog.id, id))
    const { userId } = request.user as any
    await auditService?.log({
      userId, action: 'plugin.update', resource: 'plugin',
      resourceId: id, details: updates, ipAddress: request.ip,
    })
    return { success: true, message: '更新成功' }
  })

  // ═══════════════════════════════════════════════════
  //  GET /api/admin/subscriptions — 全部订阅记录
  // ═══════════════════════════════════════════════════

  app.get('/api/admin/subscriptions', adminAuth, async (request, reply) => {
    const { status, planType, tenantId, pluginId, keyword, startDate, endDate } = request.query as any
    const { pageNum, sizeNum, offset } = parsePage(request.query as any)
    const { start, end, invalid } = parseDateRange(startDate, endDate)
    if (invalid) return sendError(reply, 400, 'INVALID_DATE_RANGE', '无效的日期范围')

    const conditions = [] as any[]
    if (status && ['active', 'pending', 'expired', 'cancelled'].includes(status)) {
      conditions.push(eq(subscriptions.status, status))
    }
    if (planType && ['monthly', 'yearly', 'lifetime'].includes(planType)) {
      conditions.push(eq(subscriptions.planType, planType))
    }
    if (tenantId) conditions.push(eq(subscriptions.tenantId, tenantId))
    if (pluginId) conditions.push(eq(subscriptions.pluginId, pluginId))
    if (keyword) {
      conditions.push(or(
        like(tenants.name, `%${keyword}%`),
        like(pluginCatalog.name, `%${keyword}%`),
      ))
    }
    if (start) conditions.push(gte(subscriptions.createdAt, start))
    if (end) conditions.push(lte(subscriptions.createdAt, end))

    const whereExpr = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: subscriptions.id,
          tenantId: subscriptions.tenantId,
          pluginId: subscriptions.pluginId,
          status: subscriptions.status,
          planType: subscriptions.planType,
          isEnabled: subscriptions.isEnabled,
          startedAt: subscriptions.startedAt,
          expiresAt: subscriptions.expiresAt,
          createdAt: subscriptions.createdAt,
          tenantName: tenants.name,
          pluginName: pluginCatalog.name,
        })
        .from(subscriptions)
        .leftJoin(tenants, eq(subscriptions.tenantId, tenants.id))
        .leftJoin(pluginCatalog, eq(subscriptions.pluginId, pluginCatalog.id))
        .where(whereExpr)
        .orderBy(desc(subscriptions.createdAt))
        .limit(sizeNum)
        .offset(offset),
      db.select({ value: count() }).from(subscriptions).leftJoin(tenants, eq(subscriptions.tenantId, tenants.id)).leftJoin(pluginCatalog, eq(subscriptions.pluginId, pluginCatalog.id)).where(whereExpr),
    ])

    return { success: true, data: { rows, total: total.value, page: pageNum, size: sizeNum } }
  })

  // ═══════════════════════════════════════════════════
  //  GET /api/admin/payments — 支付流水
  // ═══════════════════════════════════════════════════

  app.get('/api/admin/payments', adminAuth, async (request, reply) => {
    const { status, provider, tenantId, pluginId, userId, keyword, riskDecision, startDate, endDate } = request.query as any
    const { pageNum, sizeNum, offset } = parsePage(request.query as any)
    const { start, end, invalid } = parseDateRange(startDate, endDate)
    if (invalid) return sendError(reply, 400, 'INVALID_DATE_RANGE', '无效的日期范围')

    const conditions = [] as any[]
    if (status && ['pending', 'paid', 'refunded', 'failed'].includes(status)) {
      conditions.push(eq(payments.status, status))
    }
    if (provider) conditions.push(eq(payments.provider, provider))
    if (tenantId) conditions.push(eq(payments.tenantId, tenantId))
    if (pluginId) conditions.push(eq(payments.pluginId, pluginId))
    if (riskDecision && ['pass', 'review', 'reject'].includes(riskDecision)) {
      conditions.push(eq(payments.riskDecision, riskDecision))
    }
    if (userId && Number.isInteger(parseInt(userId, 10))) {
      conditions.push(eq(payments.userId, parseInt(userId, 10)))
    }
    if (keyword) {
      conditions.push(or(
        like(platformUsers.username, `%${keyword}%`),
        like(tenants.name, `%${keyword}%`),
        like(pluginCatalog.name, `%${keyword}%`),
      ))
    }
    if (start) conditions.push(gte(payments.createdAt, start))
    if (end) conditions.push(lte(payments.createdAt, end))

    const whereExpr = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: payments.id,
          userId: payments.userId,
          tenantId: payments.tenantId,
          pluginId: payments.pluginId,
          amount: payments.amount,
          provider: payments.provider,
          status: payments.status,
          riskDecision: payments.riskDecision,
          riskReason: payments.riskReason,
          riskCheckedAt: payments.riskCheckedAt,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
          username: platformUsers.username,
          tenantName: tenants.name,
          pluginName: pluginCatalog.name,
        })
        .from(payments)
        .leftJoin(platformUsers, eq(payments.userId, platformUsers.id))
        .leftJoin(tenants, eq(payments.tenantId, tenants.id))
        .leftJoin(pluginCatalog, eq(payments.pluginId, pluginCatalog.id))
        .where(whereExpr)
        .orderBy(desc(payments.createdAt))
        .limit(sizeNum)
        .offset(offset),
      db.select({ value: count() }).from(payments).leftJoin(platformUsers, eq(payments.userId, platformUsers.id)).leftJoin(tenants, eq(payments.tenantId, tenants.id)).leftJoin(pluginCatalog, eq(payments.pluginId, pluginCatalog.id)).where(whereExpr),
    ])

    return { success: true, data: { rows, total: total.value, page: pageNum, size: sizeNum } }
  })

  app.get('/api/admin/subscriptions/export.csv', adminAuth, async (request, reply) => {
    const { status, planType, tenantId, pluginId, keyword, startDate, endDate } = request.query as any
    const { start, end, invalid } = parseDateRange(startDate, endDate)
    if (invalid) return sendError(reply, 400, 'INVALID_DATE_RANGE', '无效的日期范围')

    const conditions = [] as any[]
    if (status && ['active', 'pending', 'expired', 'cancelled'].includes(status)) {
      conditions.push(eq(subscriptions.status, status))
    }
    if (planType && ['monthly', 'yearly', 'lifetime'].includes(planType)) {
      conditions.push(eq(subscriptions.planType, planType))
    }
    if (tenantId) conditions.push(eq(subscriptions.tenantId, tenantId))
    if (pluginId) conditions.push(eq(subscriptions.pluginId, pluginId))
    if (keyword) {
      conditions.push(or(
        like(tenants.name, `%${keyword}%`),
        like(pluginCatalog.name, `%${keyword}%`),
      ))
    }
    if (start) conditions.push(gte(subscriptions.createdAt, start))
    if (end) conditions.push(lte(subscriptions.createdAt, end))

    const whereExpr = conditions.length > 0 ? and(...conditions) : undefined
    const [totalRow] = await db
      .select({ value: count() })
      .from(subscriptions)
      .leftJoin(tenants, eq(subscriptions.tenantId, tenants.id))
      .leftJoin(pluginCatalog, eq(subscriptions.pluginId, pluginCatalog.id))
      .where(whereExpr)

    if ((totalRow?.value ?? 0) > EXPORT_SYNC_LIMIT) {
      return sendError(reply, 413, 'EXPORT_LIMIT_EXCEEDED', `导出数量超过同步上限 ${EXPORT_SYNC_LIMIT}，请缩小筛选范围`)
    }

    const rows = await db
      .select({
        id: subscriptions.id,
        tenantId: subscriptions.tenantId,
        tenantName: tenants.name,
        pluginId: subscriptions.pluginId,
        pluginName: pluginCatalog.name,
        status: subscriptions.status,
        planType: subscriptions.planType,
        isEnabled: subscriptions.isEnabled,
        startedAt: subscriptions.startedAt,
        expiresAt: subscriptions.expiresAt,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .leftJoin(tenants, eq(subscriptions.tenantId, tenants.id))
      .leftJoin(pluginCatalog, eq(subscriptions.pluginId, pluginCatalog.id))
      .where(whereExpr)
      .orderBy(desc(subscriptions.createdAt))
      .limit(EXPORT_SYNC_LIMIT)

    const csv = buildCsv(
      ['id', 'tenantId', 'tenantName', 'pluginId', 'pluginName', 'status', 'planType', 'isEnabled', 'startedAt', 'expiresAt', 'createdAt'],
      rows.map((row) => [
        row.id,
        row.tenantId,
        row.tenantName ?? '',
        row.pluginId,
        row.pluginName ?? '',
        row.status,
        row.planType,
        row.isEnabled,
        formatDateTime(row.startedAt),
        formatDateTime(row.expiresAt),
        formatDateTime(row.createdAt),
      ]),
    )

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${makeExportFilename('subscriptions')}"`)

    return reply.send(csv)
  })

  app.get('/api/admin/payments/export.csv', adminAuth, async (request, reply) => {
    const { status, provider, tenantId, pluginId, userId, keyword, riskDecision, startDate, endDate } = request.query as any
    const { start, end, invalid } = parseDateRange(startDate, endDate)
    if (invalid) return sendError(reply, 400, 'INVALID_DATE_RANGE', '无效的日期范围')

    const conditions = [] as any[]
    if (status && ['pending', 'paid', 'refunded', 'failed'].includes(status)) {
      conditions.push(eq(payments.status, status))
    }
    if (provider) conditions.push(eq(payments.provider, provider))
    if (tenantId) conditions.push(eq(payments.tenantId, tenantId))
    if (pluginId) conditions.push(eq(payments.pluginId, pluginId))
    if (riskDecision && ['pass', 'review', 'reject'].includes(riskDecision)) {
      conditions.push(eq(payments.riskDecision, riskDecision))
    }
    if (userId && Number.isInteger(parseInt(userId, 10))) {
      conditions.push(eq(payments.userId, parseInt(userId, 10)))
    }
    if (keyword) {
      conditions.push(or(
        like(platformUsers.username, `%${keyword}%`),
        like(tenants.name, `%${keyword}%`),
        like(pluginCatalog.name, `%${keyword}%`),
      ))
    }
    if (start) conditions.push(gte(payments.createdAt, start))
    if (end) conditions.push(lte(payments.createdAt, end))

    const whereExpr = conditions.length > 0 ? and(...conditions) : undefined
    const [totalRow] = await db
      .select({ value: count() })
      .from(payments)
      .leftJoin(platformUsers, eq(payments.userId, platformUsers.id))
      .leftJoin(tenants, eq(payments.tenantId, tenants.id))
      .leftJoin(pluginCatalog, eq(payments.pluginId, pluginCatalog.id))
      .where(whereExpr)

    if ((totalRow?.value ?? 0) > EXPORT_SYNC_LIMIT) {
      return sendError(reply, 413, 'EXPORT_LIMIT_EXCEEDED', `导出数量超过同步上限 ${EXPORT_SYNC_LIMIT}，请缩小筛选范围`)
    }

    const rows = await db
      .select({
        id: payments.id,
        userId: payments.userId,
        username: platformUsers.username,
        tenantId: payments.tenantId,
        tenantName: tenants.name,
        pluginId: payments.pluginId,
        pluginName: pluginCatalog.name,
        amount: payments.amount,
        provider: payments.provider,
        status: payments.status,
        riskDecision: payments.riskDecision,
        riskReason: payments.riskReason,
        riskCheckedAt: payments.riskCheckedAt,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(platformUsers, eq(payments.userId, platformUsers.id))
      .leftJoin(tenants, eq(payments.tenantId, tenants.id))
      .leftJoin(pluginCatalog, eq(payments.pluginId, pluginCatalog.id))
      .where(whereExpr)
      .orderBy(desc(payments.createdAt))
      .limit(EXPORT_SYNC_LIMIT)

    const csv = buildCsv(
      ['id', 'userId', 'username', 'tenantId', 'tenantName', 'pluginId', 'pluginName', 'amount', 'provider', 'status', 'riskDecision', 'riskReason', 'riskCheckedAt', 'paidAt', 'createdAt'],
      rows.map((row) => [
        row.id,
        row.userId,
        row.username ?? '',
        row.tenantId,
        row.tenantName ?? '',
        row.pluginId,
        row.pluginName ?? '',
        row.amount,
        row.provider ?? '',
        row.status,
        row.riskDecision,
        row.riskReason ?? '',
        formatDateTime(row.riskCheckedAt),
        formatDateTime(row.paidAt),
        formatDateTime(row.createdAt),
      ]),
    )

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${makeExportFilename('payments')}"`)

    return reply.send(csv)
  })

  app.get('/api/admin/audit-logs/export.csv', adminAuth, async (request, reply) => {
    const { action, userId, startDate, endDate } = request.query as any
    const { start, end, invalid } = parseDateRange(startDate, endDate)
    if (invalid) return sendError(reply, 400, 'INVALID_DATE_RANGE', '无效的日期范围')

    const conditions = [] as any[]
    if (action) conditions.push(eq(auditLogs.action, action))
    if (userId && Number.isInteger(parseInt(userId, 10))) {
      conditions.push(eq(auditLogs.userId, parseInt(userId, 10)))
    }
    if (start) conditions.push(gte(auditLogs.createdAt, start))
    if (end) conditions.push(lte(auditLogs.createdAt, end))

    const whereExpr = conditions.length > 0 ? and(...conditions) : undefined

    const [totalRow] = await db
      .select({ value: count() })
      .from(auditLogs)
      .where(whereExpr)

    if ((totalRow?.value ?? 0) > EXPORT_SYNC_LIMIT) {
      return sendError(reply, 413, 'EXPORT_LIMIT_EXCEEDED', `导出数量超过同步上限 ${EXPORT_SYNC_LIMIT}，请缩小筛选范围`)
    }

    const rows = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        username: platformUsers.username,
        email: platformUsers.email,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(platformUsers, eq(auditLogs.userId, platformUsers.id))
      .where(whereExpr)
      .orderBy(desc(auditLogs.createdAt))
      .limit(EXPORT_SYNC_LIMIT)

    const csv = buildCsv(
      ['id', 'userId', 'username', 'email', 'action', 'resource', 'resourceId', 'details', 'ipAddress', 'createdAt'],
      rows.map((row) => [
        row.id,
        row.userId,
        row.username ?? '',
        row.email ?? '',
        row.action,
        row.resource,
        row.resourceId ?? '',
        row.details ?? '',
        row.ipAddress ?? '',
        formatDateTime(row.createdAt),
      ]),
    )

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${makeExportFilename('audit-logs')}"`)

    return reply.send(csv)
  })

  // ═══════════════════════════════════════════════════
  //  GET /api/admin/audit-logs — 审计日志查询
  // ═══════════════════════════════════════════════════

  app.get('/api/admin/audit-logs', adminAuth, async (request) => {
    if (!auditService) {
      return { success: true, data: { rows: [], total: 0, page: 1, size: 20 } }
    }
    const { action, userId, startDate, endDate, page = '1', size = '20' } = request.query as any
    const result = await auditService.query({
      action: action || undefined,
      userId: userId ? parseInt(userId, 10) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: parseInt(page, 10) || 1,
      size: parseInt(size, 10) || 20,
    })
    return { success: true, data: result }
  })

  app.post('/api/admin/payments/batch', adminAuth, async (request, reply) => {
    if (!subscriptionService) {
      return sendError(reply, 500, 'SUBSCRIPTION_SERVICE_UNAVAILABLE', '订阅服务未初始化')
    }

    const { ids, action } = request.body as any
    if (!Array.isArray(ids) || ids.length === 0) {
      return sendError(reply, 400, 'INVALID_PAYMENT_IDS', '请提供支付 ID 列表')
    }
    if (!['confirm', 'reject'].includes(action)) {
      return sendError(reply, 400, 'INVALID_PAYMENT_ACTION', '无效的批量支付操作')
    }

    const uniqueIds = Array.from(new Set(ids.map((v: any) => parseInt(v, 10)).filter((v: number) => Number.isInteger(v) && v > 0)))
    if (uniqueIds.length === 0) {
      return sendError(reply, 400, 'INVALID_PAYMENT_IDS', '支付 ID 列表无效')
    }

    const results: Array<{ id: number; success: boolean; outcome?: string; code?: string; error?: string }> = []
    for (const id of uniqueIds) {
      try {
        const result = action === 'confirm'
          ? await subscriptionService.confirmPayment(id)
          : await subscriptionService.rejectPayment(id)
        results.push({ id, success: true, outcome: result.outcome })
      } catch (err: any) {
        if (err instanceof SubscriptionError) {
          results.push({ id, success: false, code: err.code, error: err.message })
        } else {
          results.push({ id, success: false, code: 'PAYMENT_BATCH_FAILED', error: err?.message || '批量支付处理失败' })
        }
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failedCount = results.length - successCount
    const { userId } = request.user as any
    await auditService?.log({
      userId,
      action: action === 'confirm' ? 'payment.batch_confirm' : 'payment.batch_reject',
      resource: 'payment',
      resourceId: uniqueIds.join(','),
      details: { ids: uniqueIds, successCount, failedCount },
      ipAddress: request.ip,
    })

    return reply.send({
      success: true,
      data: {
        action,
        total: results.length,
        successCount,
        failedCount,
        results,
      },
    })
  })

  app.post('/api/admin/payments/:id/confirm', adminAuth, async (request, reply) => {
    if (!subscriptionService) {
      return sendError(reply, 500, 'SUBSCRIPTION_SERVICE_UNAVAILABLE', '订阅服务未初始化')
    }
    const { id } = request.params as any
    const paymentId = parseInt(id, 10)
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return sendError(reply, 400, 'INVALID_PAYMENT_ID', '无效的支付 ID')
    }
    try {
      const result = await subscriptionService.confirmPayment(paymentId)
      const { userId } = request.user as any
      await auditService?.log({
        userId,
        action: 'payment.confirm',
        resource: 'payment',
        resourceId: String(paymentId),
        details: { outcome: result.outcome },
        ipAddress: request.ip,
      })
      return { success: true, data: result, message: result.outcome === 'already_confirmed' ? '支付已确认（幂等）' : '支付已确认' }
    } catch (err: any) {
      if (err instanceof SubscriptionError) {
        const statusCode = err.code === 'PAYMENT_NOT_FOUND' ? 404 : 409
        return sendError(reply, statusCode, err.code, err.message)
      }
      return sendError(reply, 400, 'PAYMENT_CONFIRM_FAILED', err?.message || '支付确认失败')
    }
  })

  // ═══════════════════════════════════════════════════
  //  POST /api/admin/payments/:id/refund — 退款
  // ═══════════════════════════════════════════════════

  app.post('/api/admin/payments/:id/refund', adminAuth, async (request, reply) => {
    if (!subscriptionService) {
      return sendError(reply, 500, 'SUBSCRIPTION_SERVICE_UNAVAILABLE', '订阅服务未初始化')
    }
    const { id } = request.params as any
    const paymentId = parseInt(id, 10)
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return sendError(reply, 400, 'INVALID_PAYMENT_ID', '无效的支付 ID')
    }
    try {
      const result = await subscriptionService.refundPayment(paymentId)
      const { userId } = request.user as any
      await auditService?.log({
        userId,
        action: 'payment.refund',
        resource: 'payment',
        resourceId: String(paymentId),
        details: { outcome: result.outcome },
        ipAddress: request.ip,
      })
      return {
        success: true,
        data: result,
        message: result.outcome === 'already_refunded' ? '支付已退款（幂等）' : '支付退款成功',
      }
    } catch (err: any) {
      if (err instanceof SubscriptionError) {
        const statusCode = err.code === 'PAYMENT_NOT_FOUND' ? 404 : 409
        return sendError(reply, statusCode, err.code, err.message)
      }
      return sendError(reply, 400, 'PAYMENT_REFUND_FAILED', err?.message || '支付退款失败')
    }
  })

  // ═══════════════════════════════════════════════════
  //  POST /api/admin/payments/:id/reject — 拒绝支付
  // ═══════════════════════════════════════════════════

  app.post('/api/admin/payments/:id/reject', adminAuth, async (request, reply) => {
    if (!subscriptionService) {
      return sendError(reply, 500, 'SUBSCRIPTION_SERVICE_UNAVAILABLE', '订阅服务未初始化')
    }
    const { id } = request.params as any
    const paymentId = parseInt(id, 10)
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return sendError(reply, 400, 'INVALID_PAYMENT_ID', '无效的支付 ID')
    }
    try {
      const result = await subscriptionService.rejectPayment(paymentId)
      const { userId } = request.user as any
      await auditService?.log({
        userId,
        action: 'payment.reject',
        resource: 'payment',
        resourceId: String(paymentId),
        details: { outcome: result.outcome },
        ipAddress: request.ip,
      })
      return { success: true, data: result, message: result.outcome === 'already_rejected' ? '支付已拒绝（幂等）' : '支付已拒绝' }
    } catch (err: any) {
      if (err instanceof SubscriptionError) {
        const statusCode = err.code === 'PAYMENT_NOT_FOUND' ? 404 : 409
        return sendError(reply, statusCode, err.code, err.message)
      }
      return sendError(reply, 400, 'PAYMENT_REJECT_FAILED', err?.message || '支付拒绝失败')
    }
  })
}
