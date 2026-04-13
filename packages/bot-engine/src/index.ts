import { BotEngine, type BotEngineConfig } from './engine.js'

/**
 * Child process entry point for @kook-saas/bot-engine.
 *
 * Expects an IPC message from the parent process containing:
 * { type: 'start', config: BotEngineConfig, plugins?: ... }
 */

let engine: BotEngine | null = null

async function handleStart(config: BotEngineConfig): Promise<void> {
  try {
    engine = new BotEngine(config)

    // Dynamically import available plugins from @kook-saas/plugins
    try {
      const pluginsModule = await import('@kook-saas/plugins')
      if (typeof pluginsModule.getAllPlugins === 'function') {
        const allPlugins = pluginsModule.getAllPlugins()
        for (const plugin of allPlugins) {
          engine.registerPlugin(plugin)
        }
      }
    } catch {
      // @kook-saas/plugins may not be available yet
      if (process.send) {
        process.send({
          type: 'warn',
          tenantId: config.tenantId,
          message: 'Could not load @kook-saas/plugins, starting with no plugins registered',
        })
      }
    }

    await engine.start()

    if (process.send) {
      process.send({
        type: 'status',
        tenantId: config.tenantId,
        status: 'running',
        port: config.port,
      })
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    if (process.send) {
      process.send({
        type: 'error',
        tenantId: config.tenantId,
        error: errorMessage,
      })
    }
    process.exit(1)
  }
}

async function handleStop(): Promise<void> {
  if (engine) {
    await engine.stop()
    engine = null
  }
  process.exit(0)
}

// Listen for IPC messages from parent process
process.on('message', (msg: any) => {
  if (!msg || typeof msg !== 'object') return

  switch (msg.type) {
    case 'start':
      handleStart(msg.config as BotEngineConfig)
      break
    case 'stop':
      handleStop()
      break
    default:
      break
  }
})

// Graceful shutdown on SIGTERM
process.on('SIGTERM', async () => {
  if (engine) {
    await engine.stop()
    engine = null
  }
  process.exit(0)
})

// Graceful shutdown on SIGINT
process.on('SIGINT', async () => {
  if (engine) {
    await engine.stop()
    engine = null
  }
  process.exit(0)
})

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  if (process.send) {
    process.send({
      type: 'error',
      error: `Uncaught exception: ${err.message}`,
    })
  }
  console.error('[bot-engine] Uncaught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  if (process.send) {
    process.send({
      type: 'error',
      error: `Unhandled rejection: ${reason}`,
    })
  }
  console.error('[bot-engine] Unhandled rejection:', reason)
  process.exit(1)
})

// Exports for programmatic usage
export { BotEngine } from './engine.js'
export type { BotEngineConfig } from './engine.js'
export { KookApi } from './kookApi.js'
export { ScopedRedisImpl } from './scopedRedis.js'
export { TenantDBImpl } from './db.js'
export { createPluginContext } from './pluginContext.js'
export type { CreatePluginContextOpts } from './pluginContext.js'
export { PluginLoader } from './pluginLoader.js'
export { Dispatcher } from './dispatcher.js'
export { CommandRouter } from './commandRouter.js'
export { TimerManager } from './timerManager.js'
