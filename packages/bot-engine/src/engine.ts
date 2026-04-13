import Fastify, { type FastifyInstance } from 'fastify'
import formbody from '@fastify/formbody'
import cors from '@fastify/cors'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import Redis from 'ioredis'
import pino from 'pino'

import type {
  KookEvent,
  KookMessageEvent,
  IPlugin,
} from '@kook-saas/shared'
import { decryptWebhookBody } from '@kook-saas/shared'

import { KookApi } from './kookApi.js'
import { ScopedRedisImpl } from './scopedRedis.js'
import { TenantDBImpl } from './db.js'
import { createPluginContext } from './pluginContext.js'
import { PluginLoader } from './pluginLoader.js'
import { Dispatcher } from './dispatcher.js'
import { CommandRouter } from './commandRouter.js'
import { TimerManager } from './timerManager.js'

export interface BotEngineConfig {
  tenantId: string
  botToken: string
  verifyToken?: string
  encryptKey?: string
  port: number
  enabledPlugins: string[]
  mysqlUrl: string
  redisUrl: string
}

export class BotEngine {
  private readonly config: BotEngineConfig
  private readonly logger = pino({ name: 'bot-engine' })

  private kookApi!: KookApi
  private db!: TenantDBImpl
  private redis!: Redis
  private scopedRedis!: ScopedRedisImpl
  private pluginLoader = new PluginLoader()
  private dispatcher = new Dispatcher()
  private commandRouter = new CommandRouter()
  private timerManager = new TimerManager()
  private server!: FastifyInstance
  private mysqlConnection!: mysql.Pool
  private heartbeatInterval: NodeJS.Timeout | null = null

  /** Externally registered plugin constructors/instances */
  private availablePlugins: IPlugin[] = []

  constructor(config: BotEngineConfig) {
    this.config = config
  }

  /**
   * Register a plugin instance before start() is called.
   */
  registerPlugin(plugin: IPlugin): void {
    this.availablePlugins.push(plugin)
  }

  async start(): Promise<void> {
    const { tenantId, botToken, port, mysqlUrl, redisUrl, enabledPlugins, encryptKey, verifyToken } = this.config

    this.logger.info(`Starting bot engine for tenant ${tenantId} on port ${port}`)

    // 1. Create Kook API client
    this.kookApi = new KookApi(botToken)

    // 2. Connect to MySQL
    this.mysqlConnection = mysql.createPool(mysqlUrl)
    const drizzleDb = drizzle(this.mysqlConnection)

    // 3. Connect to Redis
    this.redis = new Redis(redisUrl)

    // 4. Create scoped wrappers
    this.scopedRedis = new ScopedRedisImpl(this.redis, tenantId)
    this.db = new TenantDBImpl(drizzleDb, tenantId)

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

    // 9. Create Fastify server
    this.server = Fastify({ logger: false })
    await this.server.register(cors)
    await this.server.register(formbody)

    // 10. Webhook endpoint
    this.server.post('/khl-wh', async (request, reply) => {
      try {
        let body = request.body as any

        // Handle encrypted payloads
        if (body?.encrypt && encryptKey) {
          const decrypted = decryptWebhookBody(body.encrypt, encryptKey)
          body = JSON.parse(decrypted)
        }

        // Handle challenge (webhook verification)
        if (body?.d?.channel_type === 'WEBHOOK_CHALLENGE' || body?.s === 0) {
          // Type 0 = event, Type 1 = hello, etc.
        }

        // Verify token if configured
        if (verifyToken && body?.d?.verify_token && body.d.verify_token !== verifyToken) {
          return reply.code(403).send({ error: 'Invalid verify token' })
        }

        // Handle challenge verification
        if (body?.d?.type === 255 && body?.d?.channel_type === 'WEBHOOK_CHALLENGE') {
          return reply.send({ challenge: body.d.challenge })
        }

        const event: KookEvent = body?.d
        if (!event) {
          return reply.code(200).send({ ok: true })
        }

        // Try command handling first for message events (type 1, 9, 10)
        if (event.type === 1 || event.type === 9 || event.type === 10) {
          const handled = await this.commandRouter.handleCommand(event as KookMessageEvent)
          if (handled) {
            return reply.code(200).send({ ok: true })
          }
        }

        // Dispatch to event handlers
        await this.dispatcher.dispatch(event)

        return reply.code(200).send({ ok: true })
      } catch (err) {
        this.logger.error(`Webhook processing error: ${err}`)
        return reply.code(200).send({ ok: true })
      }
    })

    // 11. Register plugin API routes
    for (const [pluginId, { plugin, ctx }] of loadedPlugins) {
      const routes = plugin.getApiRoutes()
      for (const route of routes) {
        const fullPath = `/api/plugins/${pluginId}${route.path}`
        const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch'

        this.server[method](fullPath, async (req, rep) => {
          try {
            await route.handler(req, rep, ctx)
          } catch (err) {
            this.logger.error(`API route error [${pluginId}] ${route.method} ${route.path}: ${err}`)
            rep.code(500).send({ error: 'Internal server error' })
          }
        })
      }
    }

    // 12. Start listening
    await this.server.listen({ port, host: '0.0.0.0' })
    this.logger.info(`Bot engine for tenant ${tenantId} listening on port ${port}`)

    // 13. Start heartbeat
    this.startHeartbeat()
  }

  async stop(): Promise<void> {
    this.logger.info(`Stopping bot engine for tenant ${this.config.tenantId}`)

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

    // Close server
    if (this.server) {
      await this.server.close()
    }

    // Close Redis
    if (this.redis) {
      this.redis.disconnect()
    }

    // Close MySQL
    if (this.mysqlConnection) {
      await this.mysqlConnection.end()
    }

    this.logger.info(`Bot engine for tenant ${this.config.tenantId} stopped`)
  }

  /**
   * Send heartbeat via IPC to parent process.
   */
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

  private startHeartbeat(): void {
    // Send immediately
    this.sendHeartbeat()
    // Then every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat()
    }, 30_000)
  }
}
