import type { FastifyInstance } from 'fastify'
import axios from 'axios'
import type { TenantService } from '../services/TenantService.js'
import type { InstanceManager } from '../services/InstanceService.js'
import type { SubscriptionService } from '../services/SubscriptionService.js'
import { SubscriptionError } from '../services/SubscriptionService.js'
import type { AuditService } from '../services/AuditService.js'

function sendError(
  reply: any,
  statusCode: number,
  code: string,
  error: string,
  details?: unknown,
) {
  const payload: Record<string, unknown> = { success: false, code, error }
  if (details !== undefined) payload.details = details
  return reply.code(statusCode).send(payload)
}

const METHOD_SET = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])

export function registerTenantPluginRuntimeRoutes(
  app: FastifyInstance,
  tenantService: TenantService,
  instanceManager: InstanceManager,
  subscriptionService: SubscriptionService,
  auditService?: AuditService,
) {
  app.all('/api/tenants/:tenantId/plugins/:pluginId/runtime/*', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const startedAt = Date.now()
    const { userId } = request.user as any
    const { tenantId, pluginId } = request.params as any
    const method = String(request.method || 'GET').toUpperCase()
    const idempotencyKey = String(request.headers['idempotency-key'] || '') || null
    const requestId = (request as any).requestId || `${Date.now()}`

    const logAudit = async (statusCode: number, extra: Record<string, unknown> = {}) => {
      await auditService?.log({
        userId,
        action: 'plugin.runtime.access',
        resource: 'plugin_runtime',
        resourceId: `${tenantId}:${pluginId}`,
        details: {
          tenantId,
          pluginId,
          method,
          path: (request.params as any)['*'] || '/',
          statusCode,
          idempotencyKey,
          requestId,
          latencyMs: Date.now() - startedAt,
          ...extra,
        },
        ipAddress: request.ip,
      })
    }

    try {
      const owned = await tenantService.verifyOwnership(tenantId, userId)
      if (!owned) {
        await logAudit(403, { code: 'FORBIDDEN', denied: true })
        return sendError(reply, 403, 'FORBIDDEN', '无权访问该租户实例')
      }

      await subscriptionService.assertRuntimeAccessible(tenantId, pluginId)

      const runtime = instanceManager.getRuntimeApiAccess(tenantId)
      if (!runtime) {
        await logAudit(409, { code: 'INSTANCE_NOT_RUNNING', denied: true })
        return sendError(reply, 409, 'INSTANCE_NOT_RUNNING', '实例未运行，暂不可访问插件运行时接口')
      }

      if (!METHOD_SET.has(method)) {
        await logAudit(405, { code: 'METHOD_NOT_ALLOWED', denied: true })
        return sendError(reply, 405, 'METHOD_NOT_ALLOWED', '不支持的请求方法')
      }

      const wildcard = (request.params as any)['*'] || ''
      const normalizedPath = wildcard ? `/${String(wildcard).replace(/^\/+/, '')}` : '/'

      const queryObj = (request.query || {}) as Record<string, unknown>
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(queryObj)) {
        if (value === undefined || value === null || value === '') continue
        query.set(key, String(value))
      }
      const queryString = query.toString()

      const url = `http://127.0.0.1:${runtime.port}/internal/plugins/${pluginId}${normalizedPath}${queryString ? `?${queryString}` : ''}`

      const upstream = await axios.request({
        method: method as any,
        url,
        data: request.body,
        headers: {
          'x-internal-token': runtime.token,
          'x-operator-userid': String(userId),
          'x-request-id': requestId,
          'x-idempotency-key': idempotencyKey || undefined,
          'content-type': request.headers['content-type'] || 'application/json',
        },
        validateStatus: () => true,
      })

      const upstreamPayload = upstream.data as Record<string, unknown> | undefined
      const upstreamCode = typeof upstreamPayload?.code === 'string' ? upstreamPayload.code : undefined
      const normalizedCode = upstreamCode || (upstream.status === 404 ? 'PLUGIN_ROUTE_NOT_FOUND' : undefined)

      await logAudit(Number(upstream.status || 200), {
        upstreamStatus: upstream.status,
        code: normalizedCode,
      })

      reply.code(upstream.status)
      const contentType = upstream.headers['content-type']
      if (contentType) reply.header('content-type', contentType)

      if (upstream.status >= 400 && normalizedCode) {
        const upstreamError = typeof upstreamPayload?.error === 'string'
          ? upstreamPayload.error
          : (typeof upstreamPayload?.message === 'string' ? upstreamPayload.message : '插件运行时请求失败')
        const upstreamDetails = upstreamPayload?.details
        return sendError(reply, upstream.status, normalizedCode, upstreamError, upstreamDetails)
      }

      return reply.send(upstream.data)
    } catch (err: any) {
      if (err instanceof SubscriptionError) {
        const statusCode = ['PLUGIN_NOT_SUBSCRIBED', 'PLUGIN_NOT_ACTIVE', 'PLUGIN_DISABLED'].includes(err.code) ? 403 : 404
        await logAudit(statusCode, { code: err.code, denied: true, error: err.message })
        return sendError(reply, statusCode, err.code, err.message, err.details)
      }

      await logAudit(502, { code: 'PLUGIN_RUNTIME_UNREACHABLE', error: err?.message || '插件运行时服务不可用' })
      return sendError(reply, 502, 'PLUGIN_RUNTIME_UNREACHABLE', err?.message || '插件运行时服务不可用')
    }
  })
}
