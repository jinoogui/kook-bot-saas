import type { FastifyInstance } from 'fastify'
import type { InstanceManager } from '../services/InstanceService.js'
import type { TenantService } from '../services/TenantService.js'

export function registerInstanceRoutes(
  app: FastifyInstance,
  instanceManager: InstanceManager,
  tenantService: TenantService,
) {
  // 启动实例
  app.post('/api/instances/:id/start', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as any
      const { id } = request.params as any
      const owned = await tenantService.verifyOwnership(id, userId)
      if (!owned) return reply.code(403).send({ error: '无权操作' })
      const info = await instanceManager.startInstance(id)
      return reply.send({
        success: true,
        data: { tenantId: info.tenantId, port: info.port, status: info.status },
      })
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
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
      if (!owned) return reply.code(403).send({ error: '无权操作' })
      await instanceManager.stopInstance(id)
      return reply.send({ success: true, message: '实例已停止' })
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
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
      if (!owned) return reply.code(403).send({ error: '无权操作' })
      const info = await instanceManager.restartInstance(id)
      return reply.send({
        success: true,
        data: { tenantId: info.tenantId, port: info.port, status: info.status },
      })
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })

  // 获取实例状态
  app.get('/api/instances/:id/status', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const { id } = request.params as any
    const owned = await tenantService.verifyOwnership(id, userId)
    if (!owned) return reply.code(403).send({ error: '无权操作' })

    const info = instanceManager.getInstanceStatus(id)
    if (!info) {
      const tenant = await tenantService.getById(id)
      return reply.send({
        success: true,
        data: { tenantId: id, status: tenant?.status ?? 'stopped', port: null },
      })
    }

    return reply.send({
      success: true,
      data: {
        tenantId: info.tenantId,
        status: info.status,
        port: info.port,
        lastHeartbeat: info.lastHeartbeat,
        restartCount: info.restartCount,
        pid: info.process.pid,
      },
    })
  })
}
