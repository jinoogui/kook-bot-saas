import { loadConfig } from './config.js'
import { initPlatformDB, closePlatformDB } from './db/index.js'
import { createServer } from './server.js'
import { AuthService } from './services/AuthService.js'
import { TenantService } from './services/TenantService.js'
import { SubscriptionService } from './services/SubscriptionService.js'
import { PluginCatalogService } from './services/PluginCatalogService.js'
import { InstanceManager } from './services/InstanceService.js'
import { HealthMonitor } from './services/HealthMonitor.js'
import { WebhookProxy } from './services/WebhookProxy.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerTenantRoutes } from './routes/tenants.js'
import { registerInstanceRoutes } from './routes/instances.js'
import { registerPluginRoutes } from './routes/plugins.js'
import { registerSubscriptionRoutes } from './routes/subscriptions.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  console.info('========================================')
  console.info('  Kook Bot SaaS Platform')
  console.info('========================================')

  // 1. 加载配置
  const config = loadConfig()
  console.info(`[Platform] 环境: ${config.NODE_ENV}, 端口: ${config.PLATFORM_PORT}`)

  // 2. 初始化数据库
  const db = await initPlatformDB(config.PLATFORM_MYSQL_URL)
  console.info('[Platform] 平台数据库已连接')

  // 3. 创建 HTTP 服务器
  const app = await createServer({
    jwtSecret: config.JWT_SECRET,
    port: config.PLATFORM_PORT,
  })

  // 4. 初始化服务
  const authService = new AuthService(db, app)
  const tenantService = new TenantService(db, config.JWT_SECRET)
  const subscriptionService = new SubscriptionService(db)
  const catalogService = new PluginCatalogService(db)

  // Bot Engine 入口路径
  const engineEntry = config.BOT_ENGINE_ENTRY
    ?? path.resolve(__dirname, '../../bot-engine/dist/index.js')

  const instanceManager = new InstanceManager(
    tenantService,
    subscriptionService,
    {
      portStart: config.INSTANCE_PORT_START,
      portEnd: config.INSTANCE_PORT_END,
      mysqlUrl: config.TENANT_MYSQL_URL,
      redisUrl: config.REDIS_URL,
      engineEntryPath: engineEntry,
    },
  )

  const healthMonitor = new HealthMonitor(instanceManager, tenantService)
  const webhookProxy = new WebhookProxy(instanceManager, tenantService)

  // 5. 注册路由
  registerAuthRoutes(app, authService)
  registerTenantRoutes(app, tenantService)
  registerInstanceRoutes(app, instanceManager, tenantService)
  registerPluginRoutes(app, catalogService)
  registerSubscriptionRoutes(app, subscriptionService, tenantService)

  // Webhook 代理路由
  app.post('/khl-wh', webhookProxy.createHandler())
  app.post('/api/webhook', webhookProxy.createHandler())

  // 6. 启动服务器
  await app.listen({ port: config.PLATFORM_PORT, host: '0.0.0.0' })
  console.info(`[Platform] HTTP 服务器已启动: http://0.0.0.0:${config.PLATFORM_PORT}`)

  // 7. 启动健康监控
  healthMonitor.start()

  // 8. 恢复之前运行的实例
  await healthMonitor.recoverInstances()
  await webhookProxy.refreshRoutes()

  // 9. 定期刷新 webhook 路由 & 检查过期订阅
  setInterval(async () => {
    try {
      await webhookProxy.refreshRoutes()
    } catch (err) {
      console.error('[Platform] 刷新 webhook 路由失败:', err)
    }
  }, 60_000)

  setInterval(async () => {
    try {
      const expired = await subscriptionService.expireOverdue()
      if (expired > 0) console.info(`[Platform] ${expired} 个订阅已过期`)
    } catch (err) {
      console.error('[Platform] 检查过期订阅失败:', err)
    }
  }, 300_000)

  // 10. 优雅关闭
  const shutdown = async (signal: string) => {
    console.info(`\n[Platform] 收到 ${signal}，开始关闭...`)
    healthMonitor.stop()
    await instanceManager.stopAll()
    await app.close()
    await closePlatformDB()
    console.info('[Platform] 已关闭')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('[Platform] 启动失败:', err)
  process.exit(1)
})
