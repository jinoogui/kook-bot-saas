import type {
  PluginContext,
  KookApiClient,
  TenantDB,
  ScopedRedis,
  PluginLogger,
} from '@kook-saas/shared'
import pino from 'pino'

export interface CreatePluginContextOpts {
  tenantId: string
  kookApi: KookApiClient
  db: TenantDB
  redis: ScopedRedis
  pluginId: string
  getPluginService: <T>(pluginId: string) => T | null
}

export function createPluginContext(opts: CreatePluginContextOpts): PluginContext {
  const { tenantId, kookApi, db, redis, pluginId, getPluginService } = opts

  const baseLogger = pino({ name: `plugin:${pluginId}:${tenantId}` })

  const logger: PluginLogger = {
    info: (msg: string, ...args: any[]) => baseLogger.info(msg, ...args),
    warn: (msg: string, ...args: any[]) => baseLogger.warn(msg, ...args),
    error: (msg: string, ...args: any[]) => baseLogger.error(msg, ...args),
    debug: (msg: string, ...args: any[]) => baseLogger.debug(msg, ...args),
  }

  const configKey = `plugin:${pluginId}:config`

  const getConfig = async (): Promise<Record<string, any>> => {
    const raw = await redis.hgetall(configKey)
    const result: Record<string, any> = {}
    for (const [k, v] of Object.entries(raw)) {
      try {
        result[k] = JSON.parse(v)
      } catch {
        result[k] = v
      }
    }
    return result
  }

  const setConfig = async (key: string, value: any): Promise<void> => {
    await redis.hset(configKey, key, JSON.stringify(value))
  }

  return {
    tenantId,
    kookApi,
    db,
    redis,
    logger,
    getPluginService,
    getConfig,
    setConfig,
  }
}
