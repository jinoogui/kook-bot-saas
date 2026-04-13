import type { FastifyInstance } from 'fastify'
import type { PluginCatalogService } from '../services/PluginCatalogService.js'

export function registerPluginRoutes(app: FastifyInstance, catalogService: PluginCatalogService) {
  // 获取所有可用插件
  app.get('/api/plugins', async (_request, reply) => {
    const plugins = await catalogService.getAll()
    return reply.send({ success: true, data: plugins })
  })

  // 获取单个插件详情
  app.get('/api/plugins/:id', async (request, reply) => {
    const { id } = request.params as any
    const plugin = await catalogService.getById(id)
    if (!plugin) return reply.code(404).send({ error: '插件不存在' })
    return reply.send({ success: true, data: plugin })
  })
}
