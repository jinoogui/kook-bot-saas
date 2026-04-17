import type { FastifyInstance } from 'fastify'
import type { InstanceManager } from '../services/InstanceService.js'
import type { TenantService } from '../services/TenantService.js'
import type { AuditService } from '../services/AuditService.js'
import type { LogService } from '../services/LogService.js'

function sendError(reply: any, statusCode: number, code: string, error: string) {
  return reply.code(statusCode).send({ success: false, code, error })
}

export function registerInstanceRoutes(
  app: FastifyInstance,
  instanceManager: InstanceManager,
  tenantService: TenantService,
  auditService?: AuditService,
  logService?: LogService,
) {
  // 启动实例
  app.post('/api/instances/:id/start', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as any
      const { id } = request.params as any
      const owned = await tenantService.verifyOwnership(id, userId)
      if (!owned) return sendError(reply, 403, 'FORBIDDEN', '无权操作')
      const info = await instanceManager.startInstance(id)
      await auditService?.log({
        userId,
        action: 'instance.start',
        resource: 'instance',
        resourceId: id,
        details: {},
        ipAddress: request.ip,
      })
      return reply.send({
        success: true,
        data: { tenantId: info.tenantId, status: info.status },
      })
    } catch (err: any) {
      if (err?.message?.includes('正在启动中')) {
        return sendError(reply, 409, 'INSTANCE_ALREADY_STARTING', err.message)
      }
      if (err?.message?.includes('已在运行中')) {
        return sendError(reply, 409, 'INSTANCE_ALREADY_RUNNING', err.message)
      }
      return sendError(reply, 400, 'INSTANCE_START_FAILED', err?.message || '启动失败')
    }
  })

  // 停止实例
  app.post('/api/instances/:id/stop', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as any
      const { id } = request.params as any
      const owned = await tenantService.verifyOwnership(id, userId)
      if (!owned) return sendError(reply, 403, 'FORBIDDEN', '无权操作')
      await instanceManager.stopInstance(id)
      await auditService?.log({
        userId,
        action: 'instance.stop',
        resource: 'instance',
        resourceId: id,
        details: {},
        ipAddress: request.ip,
      })
      return reply.send({ success: true, message: '实例已停止' })
    } catch (err: any) {
      return sendError(reply, 400, 'INSTANCE_STOP_FAILED', err?.message || '停止失败')
    }
  })

  // 重启实例
  app.post('/api/instances/:id/restart', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as any
      const { id } = request.params as any
      const owned = await tenantService.verifyOwnership(id, userId)
      if (!owned) return sendError(reply, 403, 'FORBIDDEN', '无权操作')
      const info = await instanceManager.restartInstance(id)
      await auditService?.log({
        userId,
        action: 'instance.restart',
        resource: 'instance',
        resourceId: id,
        details: {},
        ipAddress: request.ip,
      })
      return reply.send({
        success: true,
        data: { tenantId: info.tenantId, status: info.status },
      })
    } catch (err: any) {
      return sendError(reply, 400, 'INSTANCE_RESTART_FAILED', err?.message || '重启失败')
    }
  })

  // 获取实例状态
  app.get('/api/instances/:id/status', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const { id } = request.params as any
    const owned = await tenantService.verifyOwnership(id, userId)
    if (!owned) return sendError(reply, 403, 'FORBIDDEN', '无权操作')

    const info = instanceManager.getInstanceStatus(id)
    if (!info) {
      const tenant = await tenantService.getById(id)
      return reply.send({
        success: true,
        data: {
          tenantId: id,
          status: tenant?.status ?? 'stopped',
          uptime: null,
          lastHeartbeat: tenant?.lastHeartbeat ?? null,
          restartCount: 0,
          pid: tenant?.pid ?? null,
        },
      })
    }

    const uptime = info.status === 'running'
      ? Math.max(0, Math.floor((Date.now() - info.startedAt) / 1000))
      : null

    return reply.send({
      success: true,
      data: {
        tenantId: info.tenantId,
        status: info.status,
        uptime,
        lastHeartbeat: info.lastHeartbeat,
        restartCount: info.restartCount,
        pid: info.process.pid,
      },
    })
  })

  // 一键诊断
  app.get('/api/instances/:id/diagnose', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const { id } = request.params as any
    const owned = await tenantService.verifyOwnership(id, userId)
    if (!owned) return sendError(reply, 403, 'FORBIDDEN', '无权操作')

    const diagnosis = await instanceManager.diagnoseInstance(id)
    const recentErrors = logService
      ? await logService.queryLogs({ tenantId: id, level: 'error', page: 1, size: 5 })
      : { rows: [] }

    return reply.send({
      success: true,
      data: {
        ...diagnosis,
        recentErrors: recentErrors.rows,
      },
    })
  })

  // 获取实例日志
  app.get('/api/instances/:id/logs', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!logService) {
      return reply.send({ success: true, data: { rows: [], total: 0, page: 1, size: 50 } })
    }
    const { userId } = request.user as any
    const { id } = request.params as any
    const owned = await tenantService.verifyOwnership(id, userId)
    if (!owned) return sendError(reply, 403, 'FORBIDDEN', '无权操作')

    const { level, search, page = '1', size = '50' } = request.query as any
    const result = await logService.queryLogs({
      tenantId: id,
      level: level || undefined,
      search: search || undefined,
      page: parseInt(page, 10) || 1,
      size: parseInt(size, 10) || 50,
    })
    return reply.send({ success: true, data: result })
  })
}
