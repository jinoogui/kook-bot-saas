/**
 * 插件系统核心接口定义
 */

import type { z } from 'zod'
import type { KookEventType, KookEvent } from './events.js'
import type { CommandDefinition } from './commands.js'

// ═══════════════════════════════════════════════════
//  Plugin Context — 注入给每个插件的上下文
// ═══════════════════════════════════════════════════

export interface KookApiClient {
  sendChannelMessage(channelId: string, content: string): Promise<void>
  sendKmarkdownMessage(channelId: string, content: string): Promise<void>
  sendCardMessage(channelId: string, cards: object[]): Promise<void>
  replyMessage(channelId: string, msgId: string, content: string): Promise<void>
  replyCardMessage(channelId: string, msgId: string, cards: object[]): Promise<void>
  addRole(guildId: string, userId: string, roleId: string): Promise<void>
  removeRole(guildId: string, userId: string, roleId: string): Promise<void>
  getChannel(channelId: string): Promise<any>
  getUser(userId: string): Promise<any>
  getGuild(guildId: string): Promise<any>
  getGuildMember(guildId: string, userId: string): Promise<any>
  deleteMessage(msgId: string): Promise<void>
  sendDirectMessage(userId: string, content: string): Promise<void>
  sendDirectCardMessage(userId: string, cards: object[]): Promise<void>
  uploadAsset(fileData: Buffer): Promise<string>
  joinVoiceChannel(channelId: string): Promise<any>
  leaveVoiceChannel(channelId: string): Promise<boolean>
  keepVoiceAlive(channelId: string): Promise<boolean>
}

/** 带 tenantId 作用域的 DB 接口 */
export interface TenantDB {
  /** 底层 drizzle 实例 */
  readonly drizzle: any
  /** 当前租户 ID */
  readonly tenantId: string
}

/** 带 tenant 前缀的 Redis 包装 */
export interface ScopedRedis {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>
  del(key: string): Promise<number>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  ttl(key: string): Promise<number>
  sadd(key: string, ...members: string[]): Promise<number>
  srem(key: string, ...members: string[]): Promise<number>
  smembers(key: string): Promise<string[]>
  sismember(key: string, member: string): Promise<number>
  hset(key: string, field: string, value: string): Promise<number>
  hget(key: string, field: string): Promise<string | null>
  hgetall(key: string): Promise<Record<string, string>>
  hdel(key: string, field: string): Promise<number>
  keys(pattern: string): Promise<string[]>
}

/** 插件日志 */
export interface PluginLogger {
  info(msg: string, ...args: any[]): void
  warn(msg: string, ...args: any[]): void
  error(msg: string, ...args: any[]): void
  debug(msg: string, ...args: any[]): void
}

export interface PluginContext {
  /** 当前租户 ID */
  tenantId: string
  /** 该租户 token 的 Kook API 客户端 */
  kookApi: KookApiClient
  /** 带 tenantId 作用域的 DB */
  db: TenantDB
  /** key 自动加 tenant 前缀的 Redis */
  redis: ScopedRedis
  /** 插件日志 */
  logger: PluginLogger
  /** 访问其他插件暴露的 service 实例 */
  getPluginService: <T>(pluginId: string) => T | null
  /** 获取当前插件配置 */
  getConfig: () => Promise<Record<string, any>>
  /** 设置当前插件配置项 */
  setConfig: (key: string, value: any) => Promise<void>
}

// ═══════════════════════════════════════════════════
//  Event Handler Definition
// ═══════════════════════════════════════════════════

export interface EventHandlerDefinition {
  /** 要监听的事件类型 */
  eventType: KookEventType | KookEventType[]
  /**
   * 优先级：数值越小越先执行
   * <0 = 预处理（如内容过滤）
   * 0 = 正常处理
   * >0 = 后处理
   */
  priority: number
  /** 处理器，返回 true 表示已处理/停止后续 */
  handler: (event: KookEvent, ctx: PluginContext) => Promise<boolean>
}

// ═══════════════════════════════════════════════════
//  Timer Definition
// ═══════════════════════════════════════════════════

export interface TimerDefinition {
  /** 定时任务名称 */
  name: string
  /** 执行间隔（毫秒） */
  intervalMs: number
  /** 定时任务处理器 */
  handler: (ctx: PluginContext) => Promise<void>
  /** onLoad 时是否立即执行一次 */
  immediate?: boolean
}

// ═══════════════════════════════════════════════════
//  API Route Definition
// ═══════════════════════════════════════════════════

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface ApiRouteDefinition {
  /** HTTP 方法 */
  method: HttpMethod
  /** 路径（相对于 /api/plugins/{pluginId}） */
  path: string
  /** 请求处理器 */
  handler: (request: any, reply: any, ctx: PluginContext) => Promise<void>
  /** 是否需要认证 */
  auth?: boolean
}

// ═══════════════════════════════════════════════════
//  Plugin Category
// ═══════════════════════════════════════════════════

export type PluginCategory = 'engagement' | 'moderation' | 'utility' | 'media' | 'social'

// ═══════════════════════════════════════════════════
//  IPlugin Interface — 所有插件必须实现
// ═══════════════════════════════════════════════════

export interface IPlugin {
  /** 插件唯一 ID，如 'points', 'welcome' */
  readonly id: string
  /** 显示名称，如 '积分系统' */
  readonly name: string
  /** 描述 */
  readonly description: string
  /** 版本号 */
  readonly version: string
  /** 分类 */
  readonly category: PluginCategory
  /** 依赖的其他插件 ID */
  readonly dependencies: string[]

  // ── 生命周期 ──────────────────────────────────
  onLoad(ctx: PluginContext): Promise<void>
  onUnload(): Promise<void>

  // ── 各模块注册 ────────────────────────────────
  /** DB 表定义（drizzle schema 对象） */
  getSchema(): Record<string, any>
  /** 斜杠命令 */
  getCommands(): CommandDefinition[]
  /** 事件处理器 */
  getEventHandlers(): EventHandlerDefinition[]
  /** HTTP API 路由 */
  getApiRoutes(): ApiRouteDefinition[]
  /** 定时任务 */
  getTimers(): TimerDefinition[]
  /** 配置 Zod schema */
  getConfigSchema(): z.ZodObject<any>
  /** 对外暴露的 service 实例（供其他插件调用） */
  getService(): unknown
}

// ═══════════════════════════════════════════════════
//  Plugin Metadata（平台侧目录用）
// ═══════════════════════════════════════════════════

export interface PluginMetadata {
  id: string
  name: string
  description: string
  version: string
  category: PluginCategory
  dependencies: string[]
  tier: 'free' | 'paid'
  priceMonthly?: number
  priceYearly?: number
  configSchema?: Record<string, unknown>
}
