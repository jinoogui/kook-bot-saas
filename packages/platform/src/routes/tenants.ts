import type { FastifyInstance } from 'fastify'
import type { TenantService } from '../services/TenantService.js'
import type { AuditService } from '../services/AuditService.js'

export function registerTenantRoutes(
  app: FastifyInstance,
  tenantService: TenantService,
  instanceManager?: { stopInstance: (id: string) => Promise<void> },
  auditService?: AuditService,
) {
  // 创建租户
  app.post('/api/tenants', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as any
      const { name, botToken, verifyToken, encryptKey } = request.body as any
      if (!name || !botToken) {
        return reply.code(400).send({ error: '请填写名称和 Bot Token' })
      }
      const tenant = await tenantService.create(userId, name, botToken, verifyToken, encryptKey)
      await auditService?.log({
        userId, action: 'tenant.create', resource: 'tenant',
        resourceId: tenant.id, details: { name }, ipAddress: request.ip,
      })
      return reply.send({ success: true, data: tenant })
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })

  // 获取用户的所有租户
  app.get('/api/tenants', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const list = await tenantService.getByUser(userId)
    return reply.send({ success: true, data: list })
  })

  // 获取单个租户详情
  app.get('/api/tenants/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const { id } = request.params as any
    const owned = await tenantService.verifyOwnership(id, userId)
    if (!owned) return reply.code(403).send({ error: '无权访问' })
    const tenant = await tenantService.getById(id)
    if (!tenant) return reply.code(404).send({ error: '租户不存在' })
    // 不返回加密的 token
    const { botToken, ...safe } = tenant
    return reply.send({ success: true, data: { ...safe, hasToken: !!botToken } })
  })

  // 更新租户
  app.put('/api/tenants/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as any
      const { id } = request.params as any
      const data = request.body as any
      await tenantService.update(id, userId, data)
      return reply.send({ success: true, message: '更新成功' })
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })

  // 删除租户
  app.delete('/api/tenants/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const { id } = request.params as any
    // Stop instance before deleting
    if (instanceManager) {
      try {
        await instanceManager.stopInstance(id)
      } catch {
        // Instance may not be running, ignore
      }
    }
    await tenantService.delete(id, userId)
    await auditService?.log({
      userId, action: 'tenant.delete', resource: 'tenant',
      resourceId: id, details: {}, ipAddress: request.ip,
    })
    return reply.send({ success: true, message: '已删除' })
  })
}
