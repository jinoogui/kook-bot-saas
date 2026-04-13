import type { FastifyInstance } from 'fastify'
import type { SubscriptionService } from '../services/SubscriptionService.js'
import type { TenantService } from '../services/TenantService.js'
import type { AuditService } from '../services/AuditService.js'

export function registerSubscriptionRoutes(
  app: FastifyInstance,
  subscriptionService: SubscriptionService,
  tenantService: TenantService,
  auditService?: AuditService,
) {
  // 获取租户的订阅列表
  app.get('/api/tenants/:tenantId/subscriptions', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const { tenantId } = request.params as any
    const owned = await tenantService.verifyOwnership(tenantId, userId)
    if (!owned) return reply.code(403).send({ error: '无权访问' })
    const subs = await subscriptionService.getAllSubscriptions(tenantId)
    return reply.send({ success: true, data: subs })
  })

  // 订阅插件
  app.post('/api/tenants/:tenantId/subscriptions', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as any
      const { tenantId } = request.params as any
      const { pluginId, planType } = request.body as any
      const owned = await tenantService.verifyOwnership(tenantId, userId)
      if (!owned) return reply.code(403).send({ error: '无权操作' })
      if (!pluginId) return reply.code(400).send({ error: '请指定插件' })
      if (planType && !['monthly', 'yearly', 'lifetime'].includes(planType)) {
        return reply.code(400).send({ error: '无效的订阅类型' })
      }
      const result = await subscriptionService.subscribe(tenantId, pluginId, planType, userId)
      await auditService?.log({
        userId, action: 'subscription.create', resource: 'subscription',
        resourceId: `${tenantId}:${pluginId}`, details: { pluginId, planType }, ipAddress: request.ip,
      })
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })

  // 取消订阅
  app.delete('/api/tenants/:tenantId/subscriptions/:pluginId', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const { tenantId, pluginId } = request.params as any
    const owned = await tenantService.verifyOwnership(tenantId, userId)
    if (!owned) return reply.code(403).send({ error: '无权操作' })
    await subscriptionService.unsubscribe(tenantId, pluginId)
    await auditService?.log({
      userId, action: 'subscription.cancel', resource: 'subscription',
      resourceId: `${tenantId}:${pluginId}`, details: { pluginId }, ipAddress: request.ip,
    })
    return reply.send({ success: true, message: '已取消订阅' })
  })

  // 启用/禁用插件
  app.patch('/api/tenants/:tenantId/subscriptions/:pluginId/toggle', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const { tenantId, pluginId } = request.params as any
    const { enabled } = request.body as any
    const owned = await tenantService.verifyOwnership(tenantId, userId)
    if (!owned) return reply.code(403).send({ error: '无权操作' })
    await subscriptionService.togglePlugin(tenantId, pluginId, !!enabled)
    return reply.send({ success: true, message: enabled ? '已启用' : '已禁用' })
  })

  // 更新插件配置
  app.put('/api/tenants/:tenantId/subscriptions/:pluginId/config', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const { tenantId, pluginId } = request.params as any
    const config = request.body as Record<string, any>
    const owned = await tenantService.verifyOwnership(tenantId, userId)
    if (!owned) return reply.code(403).send({ error: '无权操作' })
    await subscriptionService.updateConfig(tenantId, pluginId, config)
    await auditService?.log({
      userId, action: 'subscription.config_update', resource: 'subscription',
      resourceId: `${tenantId}:${pluginId}`, details: { pluginId }, ipAddress: request.ip,
    })
    return reply.send({ success: true, message: '配置已保存' })
  })
}
