import type { FastifyInstance } from 'fastify'
import type { SubscriptionService } from '../services/SubscriptionService.js'
import { SubscriptionError } from '../services/SubscriptionService.js'
import type { TenantService } from '../services/TenantService.js'
import type { InstanceManager } from '../services/InstanceService.js'
import type { AuditService } from '../services/AuditService.js'
import type { SubscriptionApplyQueueService } from '../services/SubscriptionApplyQueueService.js'

function sendError(reply: any, statusCode: number, code: string, error: string, details?: unknown) {
  const payload: Record<string, unknown> = { success: false, code, error }
  if (details !== undefined) payload.details = details
  return reply.code(statusCode).send(payload)
}

async function applyRuntimeChange(
  tenantId: string,
  tenantService: TenantService,
  instanceManager: InstanceManager,
  applyQueue: SubscriptionApplyQueueService,
  reason: string,
  payload?: Record<string, unknown>,
): Promise<{ applied: 'restarted' | 'queued' | 'noop'; applyError?: string }> {
  const inMemory = instanceManager.getInstanceStatus(tenantId)
  const status = inMemory?.status ?? (await tenantService.getById(tenantId))?.status ?? 'stopped'

  if (status === 'running') {
    try {
      await instanceManager.restartInstance(tenantId)
      return { applied: 'restarted' }
    } catch (err: any) {
      await applyQueue.enqueue(tenantId, reason, payload)
      return { applied: 'queued', applyError: err?.message || '实例重启失败' }
    }
  }

  if (status === 'starting' || status === 'stopping') {
    await applyQueue.enqueue(tenantId, reason, payload)
    return { applied: 'queued' }
  }

  return { applied: 'noop' }
}

export function registerSubscriptionRoutes(
  app: FastifyInstance,
  subscriptionService: SubscriptionService,
  tenantService: TenantService,
  instanceManager: InstanceManager,
  applyQueue: SubscriptionApplyQueueService,
  auditService?: AuditService,
) {
  // 获取租户的订阅列表
  app.get('/api/tenants/:tenantId/subscriptions', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const { tenantId } = request.params as any
    const owned = await tenantService.verifyOwnership(tenantId, userId)
    if (!owned) return sendError(reply, 403, 'FORBIDDEN', '无权访问')
    const subs = await subscriptionService.getAllSubscriptions(tenantId)
    return reply.send({ success: true, data: subs })
  })

  // 订阅插件
  app.post('/api/tenants/:tenantId/subscriptions', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const { tenantId } = request.params as any
    const { pluginId, planType } = request.body as any

    try {
      const owned = await tenantService.verifyOwnership(tenantId, userId)
      if (!owned) return sendError(reply, 403, 'FORBIDDEN', '无权操作')
      if (!pluginId) return sendError(reply, 400, 'INVALID_PLUGIN_ID', '请指定插件')
      if (planType && !['monthly', 'yearly', 'lifetime'].includes(planType)) {
        return sendError(reply, 400, 'INVALID_PLAN_TYPE', '无效的订阅类型')
      }
      const result = await subscriptionService.subscribe(tenantId, pluginId, planType, userId)

      if ((result as any)?.riskDecision === 'review') {
        await auditService?.log({
          userId,
          action: 'payment.risk_review',
          resource: 'payment',
          resourceId: String((result as any)?.paymentId ?? ''),
          details: {
            pluginId,
            planType,
            reason: (result as any)?.riskReason,
            paymentId: (result as any)?.paymentId,
          },
          ipAddress: request.ip,
        })
      }

      await auditService?.log({
        userId,
        action: 'subscription.create',
        resource: 'subscription',
        resourceId: `${tenantId}:${pluginId}`,
        details: {
          pluginId,
          planType,
          riskDecision: (result as any)?.riskDecision ?? 'pass',
          riskReason: (result as any)?.riskReason ?? null,
        },
        ipAddress: request.ip,
      })
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      if (err instanceof SubscriptionError) {
        if (err.code === 'PAYMENT_RISK_REJECTED') {
          await auditService?.log({
            userId,
            action: 'payment.risk_reject',
            resource: 'payment',
            resourceId: `${tenantId}:${pluginId}`,
            details: { pluginId, planType, reason: err.message },
            ipAddress: request.ip,
          })
          return sendError(reply, 409, err.code, err.message, err.details)
        }

        const statusCode = err.code === 'FORBIDDEN' ? 403 : 400
        return sendError(reply, statusCode, err.code, err.message, err.details)
      }
      return sendError(reply, 400, 'SUBSCRIPTION_CREATE_FAILED', err?.message || '订阅失败')
    }
  })

  // 取消订阅
  app.delete('/api/tenants/:tenantId/subscriptions/:pluginId', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as any
      const { tenantId, pluginId } = request.params as any
      const owned = await tenantService.verifyOwnership(tenantId, userId)
      if (!owned) return sendError(reply, 403, 'FORBIDDEN', '无权操作')

      await subscriptionService.unsubscribe(tenantId, pluginId)
      const runtime = await applyRuntimeChange(
        tenantId,
        tenantService,
        instanceManager,
        applyQueue,
        'subscription.cancel',
        { pluginId },
      )

      await auditService?.log({
        userId,
        action: 'subscription.cancel',
        resource: 'subscription',
        resourceId: `${tenantId}:${pluginId}`,
        details: { pluginId, runtime },
        ipAddress: request.ip,
      })
      return reply.send({
        success: true,
        message: '已取消订阅',
        data: runtime,
      })
    } catch (err: any) {
      if (err instanceof SubscriptionError) {
        return sendError(reply, 400, err.code, err.message, err.details)
      }
      return sendError(reply, 400, 'SUBSCRIPTION_CANCEL_FAILED', err?.message || '取消订阅失败')
    }
  })

  // 启用/禁用插件
  app.patch('/api/tenants/:tenantId/subscriptions/:pluginId/toggle', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as any
      const { tenantId, pluginId } = request.params as any
      const { enabled } = request.body as any
      const owned = await tenantService.verifyOwnership(tenantId, userId)
      if (!owned) return sendError(reply, 403, 'FORBIDDEN', '无权操作')

      await subscriptionService.togglePlugin(tenantId, pluginId, !!enabled)
      const runtime = await applyRuntimeChange(
        tenantId,
        tenantService,
        instanceManager,
        applyQueue,
        'subscription.toggle',
        { pluginId, enabled: !!enabled },
      )

      await auditService?.log({
        userId,
        action: 'subscription.toggle',
        resource: 'subscription',
        resourceId: `${tenantId}:${pluginId}`,
        details: { pluginId, enabled: !!enabled, runtime },
        ipAddress: request.ip,
      })

      return reply.send({
        success: true,
        message: enabled ? '已启用' : '已禁用',
        data: runtime,
      })
    } catch (err: any) {
      if (err instanceof SubscriptionError) {
        return sendError(reply, 400, err.code, err.message, err.details)
      }
      return sendError(reply, 400, 'SUBSCRIPTION_TOGGLE_FAILED', err?.message || '操作失败')
    }
  })

  // 更新插件配置
  app.put('/api/tenants/:tenantId/subscriptions/:pluginId/config', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as any
      const { tenantId, pluginId } = request.params as any
      const config = request.body as Record<string, any>
      const owned = await tenantService.verifyOwnership(tenantId, userId)
      if (!owned) return sendError(reply, 403, 'FORBIDDEN', '无权操作')

      await subscriptionService.updateConfig(tenantId, pluginId, config)
      const runtime = await applyRuntimeChange(
        tenantId,
        tenantService,
        instanceManager,
        applyQueue,
        'subscription.config_update',
        { pluginId },
      )

      await auditService?.log({
        userId,
        action: 'subscription.config_update',
        resource: 'subscription',
        resourceId: `${tenantId}:${pluginId}`,
        details: { pluginId, runtime },
        ipAddress: request.ip,
      })

      return reply.send({
        success: true,
        message: '配置已保存',
        data: runtime,
      })
    } catch (err: any) {
      if (err instanceof SubscriptionError) {
        return sendError(reply, 400, err.code, err.message, err.details)
      }
      return sendError(reply, 400, 'SUBSCRIPTION_CONFIG_UPDATE_FAILED', err?.message || '配置保存失败')
    }
  })
}
