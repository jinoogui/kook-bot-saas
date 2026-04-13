import type { FastifyInstance } from 'fastify'
import { eq, sql, count } from 'drizzle-orm'
import type { PlatformDB } from '../db/index.js'
import type { InstanceManager } from '../services/InstanceService.js'
import type { TenantService } from '../services/TenantService.js'
import type { AuditService } from '../services/AuditService.js'
import type { SubscriptionService } from '../services/SubscriptionService.js'
import {
  platformUsers,
  tenants,
  pluginCatalog,
  subscriptions,
  payments,
} from '../db/schema/index.js'

interface AdminDeps {
  db: PlatformDB
  instanceManager: InstanceManager
  tenantService: TenantService
  auditService?: AuditService
  subscriptionService?: SubscriptionService
}

export function registerAdminRoutes(app: FastifyInstance, deps: AdminDeps) {
  const { db, instanceManager, tenantService, auditService, subscriptionService } = deps
  const adminAuth = { preHandler: [app.requireAdmin] }

  // ═══════════════════════════════════════════════════
  //  GET /api/admin/stats — 平台概览统计
  // ═══════════════════════════════════════════════════

  app.get('/api/admin/stats', adminAuth, async () => {
    const [[userCount], [tenantCount], [runningCount], [revenueResult]] = await Promise.all([
      db.select({ value: count() }).from(platformUsers),
      db.select({ value: count() }).from(tenants),
      db.select({ value: count() }).from(tenants).where(eq(tenants.status, 'running')),
      db.select({ value: sql<number>`COALESCE(SUM(amount), 0)` }).from(payments).where(eq(payments.status, 'paid')),
    ])

    return {
      success: true,
      data: {
        userCount: userCount.value,
        tenantCount: tenantCount.value,
        runningCount: runningCount.value,
        totalRevenue: revenueResult.value,
      },
    }
  })

  // ═══════════════════════════════════════════════════
  //  GET /api/admin/users — 用户列表
  // ═══════════════════════════════════════════════════

  app.get('/api/admin/users', adminAuth, async (request) => {
    const { page = '1', size = '20' } = request.query as any
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const sizeNum = Math.min(100, Math.max(1, parseInt(size, 10) || 20))
    const offset = (pageNum - 1) * sizeNum

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
        .limit(sizeNum)
        .offset(offset),
      db.select({ value: count() }).from(platformUsers),
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
      return reply.code(400).send({ error: '无效的用户 ID' })
    }
    // Prevent admin from modifying their own role
    const { userId } = request.user as any
    if (role && numId === userId) {
      return reply.code(400).send({ error: '不能修改自己的角色' })
    }

    const updates: Record<string, any> = {}
    if (role && ['user', 'admin'].includes(role)) updates.role = role
    if (status && ['active', 'suspended', 'deleted'].includes(status)) updates.status = status

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: '无有效更新字段' })
    }

    await db.update(platformUsers).set(updates).where(eq(platformUsers.id, numId))
    await auditService?.log({
      userId, action: role ? 'user.role_change' : 'user.status_change', resource: 'user',
      resourceId: String(numId), details: updates, ipAddress: request.ip,
    })
    return { success: true, message: '更新成功' }
  })

  // ═══════════════════════════════════════════════════
  //  GET /api/admin/tenants — 全部租户列表
  // ═══════════════════════════════════════════════════

  app.get('/api/admin/tenants', adminAuth, async (request) => {
    const { page = '1', size = '20' } = request.query as any
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const sizeNum = Math.min(100, Math.max(1, parseInt(size, 10) || 20))
    const offset = (pageNum - 1) * sizeNum

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
        .limit(sizeNum)
        .offset(offset),
      db.select({ value: count() }).from(tenants),
    ])

    return { success: true, data: { rows, total: total.value, page: pageNum, size: sizeNum } }
  })

  // ═══════════════════════════════════════════════════
  //  POST /api/admin/tenants/:id/stop — 强制停止
  // ═══════════════════════════════════════════════════

  app.post('/api/admin/tenants/:id/stop', adminAuth, async (request, reply) => {
    const { id } = request.params as any
    if (!id || typeof id !== 'string') {
      return reply.code(400).send({ error: '无效的租户 ID' })
    }
    try {
      await instanceManager.stopInstance(id)
      return { success: true, message: '实例已停止' }
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })

  // ═══════════════════════════════════════════════════
  //  POST /api/admin/tenants/:id/restart — 强制重启
  // ═══════════════════════════════════════════════════

  app.post('/api/admin/tenants/:id/restart', adminAuth, async (request, reply) => {
    const { id } = request.params as any
    if (!id || typeof id !== 'string') {
      return reply.code(400).send({ error: '无效的租户 ID' })
    }
    try {
      const info = await instanceManager.restartInstance(id)
      return { success: true, data: { tenantId: info.tenantId, port: info.port, status: info.status } }
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })

  // ═══════════════════════════════════════════════════
  //  GET /api/admin/plugins — 插件目录(含已下架)
  // ═══════════════════════════════════════════════════

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
        return reply.code(400).send({ error: 'tier 值无效' })
      }
      updates.tier = body.tier
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: '无有效更新字段' })
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

  app.get('/api/admin/subscriptions', adminAuth, async (request) => {
    const { page = '1', size = '20' } = request.query as any
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const sizeNum = Math.min(100, Math.max(1, parseInt(size, 10) || 20))
    const offset = (pageNum - 1) * sizeNum

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
        .limit(sizeNum)
        .offset(offset),
      db.select({ value: count() }).from(subscriptions),
    ])

    return { success: true, data: { rows, total: total.value, page: pageNum, size: sizeNum } }
  })

  // ═══════════════════════════════════════════════════
  //  GET /api/admin/payments — 支付流水
  // ═══════════════════════════════════════════════════

  app.get('/api/admin/payments', adminAuth, async (request) => {
    const { page = '1', size = '20' } = request.query as any
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const sizeNum = Math.min(100, Math.max(1, parseInt(size, 10) || 20))
    const offset = (pageNum - 1) * sizeNum

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
        .limit(sizeNum)
        .offset(offset),
      db.select({ value: count() }).from(payments),
    ])

    return { success: true, data: { rows, total: total.value, page: pageNum, size: sizeNum } }
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

  // ═══════════════════════════════════════════════════
  //  POST /api/admin/payments/:id/confirm — 确认支付
  // ═══════════════════════════════════════════════════

  app.post('/api/admin/payments/:id/confirm', adminAuth, async (request, reply) => {
    if (!subscriptionService) {
      return reply.code(500).send({ error: '订阅服务未初始化' })
    }
    const { id } = request.params as any
    const paymentId = parseInt(id, 10)
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return reply.code(400).send({ error: '无效的支付 ID' })
    }
    try {
      await subscriptionService.confirmPayment(paymentId)
      const { userId } = request.user as any
      await auditService?.log({
        userId, action: 'payment.confirm', resource: 'payment',
        resourceId: String(paymentId), details: {}, ipAddress: request.ip,
      })
      return { success: true, message: '支付已确认' }
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })

  // ═══════════════════════════════════════════════════
  //  POST /api/admin/payments/:id/reject — 拒绝支付
  // ═══════════════════════════════════════════════════

  app.post('/api/admin/payments/:id/reject', adminAuth, async (request, reply) => {
    if (!subscriptionService) {
      return reply.code(500).send({ error: '订阅服务未初始化' })
    }
    const { id } = request.params as any
    const paymentId = parseInt(id, 10)
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return reply.code(400).send({ error: '无效的支付 ID' })
    }
    try {
      await subscriptionService.rejectPayment(paymentId)
      const { userId } = request.user as any
      await auditService?.log({
        userId, action: 'payment.reject', resource: 'payment',
        resourceId: String(paymentId), details: {}, ipAddress: request.ip,
      })
      return { success: true, message: '支付已拒绝' }
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })
}
