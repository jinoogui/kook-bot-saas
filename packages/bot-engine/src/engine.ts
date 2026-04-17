import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { URL } from 'url'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import Redis from 'ioredis'
import pino from 'pino'

import type {
  KookEvent,
  KookMessageEvent,
  IPlugin,
  PluginContext,
  ApiRouteDefinition,
} from '@kook-saas/shared'

import { KookApi } from './kookApi.js'
import { KookGateway } from './kookGateway.js'
import { ScopedRedisImpl } from './scopedRedis.js'
import { TenantDBImpl } from './db.js'
import { createPluginContext } from './pluginContext.js'
import { PluginLoader } from './pluginLoader.js'
import { Dispatcher } from './dispatcher.js'
import { CommandRouter } from './commandRouter.js'
import { TimerManager } from './timerManager.js'
import { createPluginRuntimeServer } from './pluginApiServer.js'

export interface BotEngineConfig {
  tenantId: string
  botToken: string
  port?: number
  enabledPlugins: string[]
  pluginConfigs?: Record<string, Record<string, any>>
  mysqlUrl: string
  redisUrl: string
  runtimeApiPort?: number
  runtimeApiToken?: string
}

export class BotEngine {
  private readonly config: BotEngineConfig
  private readonly logger = pino({ name: 'bot-engine' })

  private kookApi!: KookApi
  private gateway!: KookGateway
  private db!: TenantDBImpl
  private redis!: Redis
  private scopedRedis!: ScopedRedisImpl
  private pluginLoader = new PluginLoader()
  private dispatcher = new Dispatcher()
  private commandRouter = new CommandRouter()
  private timerManager = new TimerManager()
  private mysqlConnection!: mysql.Pool
  private heartbeatInterval: NodeJS.Timeout | null = null
  private runtimeApiServer: ReturnType<typeof createServer> | null = null

  /** Externally registered plugin constructors/instances */
  private availablePlugins: IPlugin[] = []

  constructor(config: BotEngineConfig) {
    this.config = config
  }

  registerPlugin(plugin: IPlugin): void {
    this.availablePlugins.push(plugin)
  }

  async start(): Promise<void> {
    const { tenantId, botToken, mysqlUrl, redisUrl, enabledPlugins } = this.config

    this.logger.info(`Starting bot engine for tenant ${tenantId} (WebSocket mode)`)

    // 1. Create Kook API client
    this.kookApi = new KookApi(botToken)

    // 2. Connect to MySQL
    this.mysqlConnection = mysql.createPool(mysqlUrl)
    const drizzleDb = drizzle(this.mysqlConnection)

    // 3. Connect to Redis
    this.redis = new Redis(redisUrl)
    this.redis.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err}`)
    })

    // 4. Create scoped wrappers
    this.scopedRedis = new ScopedRedisImpl(this.redis, tenantId)
    this.db = new TenantDBImpl(drizzleDb, tenantId)

    // 4.5. Sync plugin configs from MySQL (via IPC) to Redis
    const pluginConfigs = this.config.pluginConfigs ?? {}
    for (const [pluginId, cfg] of Object.entries(pluginConfigs)) {
      const configKey = `plugin:${pluginId}:config`
      for (const [k, v] of Object.entries(cfg)) {
        await this.scopedRedis.hset(configKey, k, JSON.stringify(v))
      }
    }

    // 5. Register all available plugins
    for (const plugin of this.availablePlugins) {
      this.pluginLoader.registerPlugin(plugin)
    }

    // 6. Resolve load order via topological sort
    const sortedIds = this.pluginLoader.resolveDependencies(enabledPlugins)

    // 7. Load plugins in order
    for (const pluginId of sortedIds) {
      const ctx = createPluginContext({
        tenantId,
        kookApi: this.kookApi,
        db: this.db,
        redis: this.scopedRedis,
        pluginId,
        getPluginService: <T>(id: string): T | null => {
          const entry = this.pluginLoader.getPlugin(id)
          if (!entry) return null
          return entry.plugin.getService() as T
        },
      })

      await this.pluginLoader.loadPlugin(pluginId, ctx)
      this.sendLog('info', `插件 ${pluginId} 加载完成`)

      // Register timers for this plugin
      const entry = this.pluginLoader.getPlugin(pluginId)!
      const timers = entry.plugin.getTimers()
      if (timers.length > 0) {
        this.timerManager.registerTimers(pluginId, timers, ctx)
      }
    }

    // 8. Collect event handlers and commands
    const loadedPlugins = this.pluginLoader.getLoadedPlugins()
    this.dispatcher.collectHandlers(loadedPlugins)
    this.commandRouter.collectCommands(loadedPlugins)

    // 8.5. Start internal runtime API
    await this.startRuntimeApiServer()

    // 9. Connect to Kook Gateway via WebSocket
    this.gateway = new KookGateway({
      botToken,
      onEvent: (event) => this.handleGatewayEvent(event),
      onConnected: () => {
        this.sendLog('info', 'WebSocket 状态: connected')
      },
      onDisconnected: () => {
        this.sendLog('warn', 'WebSocket 状态: disconnected')
      },
      logger: this.logger,
    })

    await this.gateway.connect()
    this.logger.info(`Bot engine for tenant ${tenantId} connected via WebSocket`)
    this.sendLog('info', `Bot 引擎启动成功 (WebSocket)，已加载 ${sortedIds.length} 个插件`, { plugins: sortedIds })

    // 10. Start heartbeat
    this.startHeartbeat()
  }

  /** Handle events received from the Kook WebSocket gateway */
  private async handleGatewayEvent(event: KookEvent): Promise<void> {
    try {
      // Nonce-based deduplication using msg_id
      const msgId = event?.msg_id
      if (msgId && this.redis) {
        const dedup = await this.redis.set(`dedup:${msgId}`, '1', 'EX', 300, 'NX')
        if (!dedup) return // Already processed
      }

      // Try command handling first for message events (type 1, 9, 10)
      if (event.type === 1 || event.type === 9 || event.type === 10) {
        const handled = await this.commandRouter.handleCommand(event as KookMessageEvent)
        if (handled) return
      }

      // Dispatch to event handlers
      await this.dispatcher.dispatch(event)
    } catch (err) {
      this.logger.error(`Event processing error: ${err}`)
      this.sendLog('error', `事件处理出错: ${err}`)
    }
  }

  async stop(): Promise<void> {
    this.logger.info(`Stopping bot engine for tenant ${this.config.tenantId}`)
    this.sendLog('info', 'Bot 引擎正在停止')

    if (this.runtimeApiServer) {
      await new Promise<void>((resolve) => {
        this.runtimeApiServer?.close(() => resolve())
      })
      this.runtimeApiServer = null
    }

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // Stop timers
    this.timerManager.stopAll()

    // Unload plugins in reverse order
    const loadedPlugins = this.pluginLoader.getLoadedPlugins()
    const pluginIds = [...loadedPlugins.keys()].reverse()
    for (const id of pluginIds) {
      try {
        await this.pluginLoader.unloadPlugin(id)
      } catch (err) {
        this.logger.error(`Error unloading plugin "${id}": ${err}`)
      }
    }

    // Disconnect gateway
    try {
      if (this.gateway) {
        this.gateway.disconnect()
      }
    } catch (err) {
      this.logger.error(`Error disconnecting gateway: ${err}`)
    }

    // Close Redis
    try {
      if (this.redis) {
        this.redis.disconnect()
      }
    } catch (err) {
      this.logger.error(`Error disconnecting Redis: ${err}`)
    }

    // Close MySQL
    try {
      if (this.mysqlConnection) {
        await this.mysqlConnection.end()
      }
    } catch (err) {
      this.logger.error(`Error closing MySQL: ${err}`)
    }

    this.logger.info(`Bot engine for tenant ${this.config.tenantId} stopped`)
  }

  sendHeartbeat(): void {
    if (process.send) {
      process.send({
        type: 'heartbeat',
        tenantId: this.config.tenantId,
        timestamp: Date.now(),
        status: 'running',
      })
    }
  }

  sendLog(level: 'info' | 'warn' | 'error', message: string, metadata?: Record<string, unknown>): void {
    if (process.send) {
      process.send({
        type: 'log',
        tenantId: this.config.tenantId,
        level,
        message,
        metadata,
        timestamp: Date.now(),
      })
    }
  }

  private startHeartbeat(): void {
    this.sendHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat()
    }, 30_000)
  }

  private async startRuntimeApiServer(): Promise<void> {
    const port = this.config.runtimeApiPort
    const token = this.config.runtimeApiToken
    if (!port || !token) {
      this.logger.info('Runtime API disabled: missing runtimeApiPort/runtimeApiToken')
      return
    }

    this.runtimeApiServer = createPluginRuntimeServer({
      tenantId: this.config.tenantId,
      internalToken: token,
      getPluginEntry: (pluginId) => this.pluginLoader.getPlugin(pluginId),
    })

    await new Promise<void>((resolve, reject) => {
      this.runtimeApiServer?.once('error', reject)
      this.runtimeApiServer?.listen(port, '127.0.0.1', () => {
        this.runtimeApiServer?.off('error', reject)
        resolve()
      })
    })

    this.sendLog('info', `插件 Runtime API 已启动: 127.0.0.1:${port}`)
  }
}
