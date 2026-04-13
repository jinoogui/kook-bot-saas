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
import { AuditService } from './services/AuditService.js'
import { LogService } from './services/LogService.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerTenantRoutes } from './routes/tenants.js'
import { registerInstanceRoutes } from './routes/instances.js'
import { registerPluginRoutes } from './routes/plugins.js'
import { registerSubscriptionRoutes } from './routes/subscriptions.js'
import { registerAdminRoutes } from './routes/admin.js'
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
    db,
    redisUrl: config.REDIS_URL,
    rateLimitGeneral: config.RATE_LIMIT_GENERAL,
  })

  // 4. 初始化服务
  const authService = new AuthService(db, app)
  const tenantService = new TenantService(db, config.JWT_SECRET)
  const subscriptionService = new SubscriptionService(db)
  const catalogService = new PluginCatalogService(db)
  const auditService = new AuditService(db)
  const logService = new LogService(db)

  // 同步插件目录（内嵌元数据，避免需要构建 plugins 包）
  const pluginMetas = [
    { id: 'welcome', name: '欢迎消息', description: '新成员入群/退群时自动发送欢迎或欢送消息', version: '1.0.0', category: 'social' as const, dependencies: [], tier: 'free' as const },
    { id: 'points', name: '积分系统', description: '签到获取积分、积分商店兑换、宝箱抽奖、排行榜', version: '1.0.0', category: 'engagement' as const, dependencies: [], tier: 'free' as const },
    { id: 'content-filter', name: '内容过滤', description: '基于AC自动机的高效敏感词过滤', version: '1.0.0', category: 'moderation' as const, dependencies: [], tier: 'free' as const },
    { id: 'reminders', name: '定时提醒', description: '支持相对/绝对时间设置提醒', version: '1.0.0', category: 'utility' as const, dependencies: [], tier: 'free' as const },
    { id: 'voice-points', name: '语音积分', description: '语音频道每小时自动获得积分', version: '1.0.0', category: 'engagement' as const, dependencies: ['points'], tier: 'paid' as const, priceMonthly: 1000, priceYearly: 10000 },
    { id: 'levels', name: '等级系统', description: '消息经验值、等级进度条、升级通知', version: '1.0.0', category: 'engagement' as const, dependencies: [], tier: 'paid' as const, priceMonthly: 500, priceYearly: 5000 },
    { id: 'keyword-reply', name: '关键词回复', description: '自动关键词触发回复，四种匹配模式', version: '1.0.0', category: 'utility' as const, dependencies: [], tier: 'paid' as const, priceMonthly: 500, priceYearly: 5000 },
    { id: 'moderation', name: '管理工具', description: '封禁/禁言管理、广告词库管理', version: '1.0.0', category: 'moderation' as const, dependencies: [], tier: 'paid' as const, priceMonthly: 800, priceYearly: 8000 },
    { id: 'role-claim', name: '身份组领取', description: '按钮卡片自助领取/移除身份组', version: '1.0.0', category: 'social' as const, dependencies: [], tier: 'paid' as const, priceMonthly: 300, priceYearly: 3000 },
    { id: 'statistics', name: '活跃统计', description: '消息计数、在线人数趋势、活跃排行', version: '1.0.0', category: 'utility' as const, dependencies: [], tier: 'paid' as const, priceMonthly: 500, priceYearly: 5000 },
    { id: 'audio-player', name: '音频播放', description: '语音频道音频播放功能', version: '1.0.0', category: 'media' as const, dependencies: [], tier: 'paid' as const, priceMonthly: 1500, priceYearly: 15000 },
  ]
  await catalogService.syncFromMetadata(pluginMetas)
  console.info(`[Platform] 已同步 ${pluginMetas.length} 个插件到目录`)

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
    logService,
  )

  const healthMonitor = new HealthMonitor(instanceManager, tenantService)
  const webhookProxy = new WebhookProxy(instanceManager, tenantService)

  // 5. 注册路由
  registerAuthRoutes(app, authService, config.RATE_LIMIT_AUTH)
  registerTenantRoutes(app, tenantService, instanceManager, auditService)
  registerInstanceRoutes(app, instanceManager, tenantService, auditService, logService)
  registerPluginRoutes(app, catalogService)
  registerSubscriptionRoutes(app, subscriptionService, tenantService, auditService)
  registerAdminRoutes(app, { db, instanceManager, tenantService, auditService, subscriptionService })

  // Webhook 代理路由（高频率限制）
  const webhookRateLimit = {
    config: {
      rateLimit: {
        max: config.RATE_LIMIT_WEBHOOK,
        timeWindow: '1 minute',
      },
    },
  }
  app.post('/khl-wh', webhookRateLimit, webhookProxy.createHandler())
  app.post('/api/webhook', webhookRateLimit, webhookProxy.createHandler())

  // 6. 启动服务器
  await app.listen({ port: config.PLATFORM_PORT, host: '0.0.0.0' })
  console.info(`[Platform] HTTP 服务器已启动: http://0.0.0.0:${config.PLATFORM_PORT}`)

  // 7. 启动健康监控
  healthMonitor.start()

  // 8. 恢复之前运行的实例
  await healthMonitor.recoverInstances()
  await webhookProxy.refreshRoutes()

  // 9. 定期刷新 webhook 路由 & 检查过期订阅
  const webhookRefreshTimer = setInterval(async () => {
    try {
      await webhookProxy.refreshRoutes()
    } catch (err) {
      console.error('[Platform] 刷新 webhook 路由失败:', err)
    }
  }, 60_000)

  const subscriptionCheckTimer = setInterval(async () => {
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
    clearInterval(webhookRefreshTimer)
    clearInterval(subscriptionCheckTimer)
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
