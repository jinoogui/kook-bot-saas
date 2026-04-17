import { and, desc, eq } from 'drizzle-orm'
import type { KookEvent, PluginContext } from '@kook-saas/shared'
import {
  pluginAntiSpamRules,
  pluginAntiSpamViolations,
  pluginAntiSpamWhitelist,
} from './schema.js'

type RuleSnapshot = {
  enabled: boolean
  maxMessagesPerWindow: number
  windowSeconds: number
  duplicateThreshold: number
  blockAtAll: boolean
  actionType: 'warn' | 'mute' | 'delete'
  muteHours: number
}

type TriggerType = 'high_frequency' | 'duplicate' | 'at_all'

type DetectResult = {
  violated: boolean
  trigger?: TriggerType
  detail?: string
}

const DEFAULT_RULE: RuleSnapshot = {
  enabled: true,
  maxMessagesPerWindow: 6,
  windowSeconds: 10,
  duplicateThreshold: 3,
  blockAtAll: true,
  actionType: 'warn',
  muteHours: 1,
}

export class AntiSpamService {
  constructor(private ctx: PluginContext) {}

  async getRule(guildId: string): Promise<RuleSnapshot> {
    const [row] = await this.ctx.db.drizzle
      .select()
      .from(pluginAntiSpamRules)
      .where(and(
        eq(pluginAntiSpamRules.tenantId, this.ctx.tenantId),
        eq(pluginAntiSpamRules.guildId, guildId),
      ))
      .limit(1)

    if (!row) {
      await this.ctx.db.drizzle
        .insert(pluginAntiSpamRules)
        .values({
          tenantId: this.ctx.tenantId,
          guildId,
          enabled: DEFAULT_RULE.enabled ? 1 : 0,
          maxMessagesPerWindow: DEFAULT_RULE.maxMessagesPerWindow,
          windowSeconds: DEFAULT_RULE.windowSeconds,
          duplicateThreshold: DEFAULT_RULE.duplicateThreshold,
          blockAtAll: DEFAULT_RULE.blockAtAll ? 1 : 0,
          actionType: DEFAULT_RULE.actionType,
          muteHours: DEFAULT_RULE.muteHours,
        })
        .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } })

      return { ...DEFAULT_RULE }
    }

    return {
      enabled: row.enabled === 1,
      maxMessagesPerWindow: Number(row.maxMessagesPerWindow ?? DEFAULT_RULE.maxMessagesPerWindow),
      windowSeconds: Number(row.windowSeconds ?? DEFAULT_RULE.windowSeconds),
      duplicateThreshold: Number(row.duplicateThreshold ?? DEFAULT_RULE.duplicateThreshold),
      blockAtAll: row.blockAtAll === 1,
      actionType: (row.actionType as RuleSnapshot['actionType']) || DEFAULT_RULE.actionType,
      muteHours: Number(row.muteHours ?? DEFAULT_RULE.muteHours),
    }
  }

  async updateRule(guildId: string, patch: Partial<RuleSnapshot>): Promise<RuleSnapshot> {
    const current = await this.getRule(guildId)
    const next: RuleSnapshot = {
      enabled: patch.enabled ?? current.enabled,
      maxMessagesPerWindow: patch.maxMessagesPerWindow ?? current.maxMessagesPerWindow,
      windowSeconds: patch.windowSeconds ?? current.windowSeconds,
      duplicateThreshold: patch.duplicateThreshold ?? current.duplicateThreshold,
      blockAtAll: patch.blockAtAll ?? current.blockAtAll,
      actionType: patch.actionType ?? current.actionType,
      muteHours: patch.muteHours ?? current.muteHours,
    }

    await this.ctx.db.drizzle
      .insert(pluginAntiSpamRules)
      .values({
        tenantId: this.ctx.tenantId,
        guildId,
        enabled: next.enabled ? 1 : 0,
        maxMessagesPerWindow: Math.max(2, next.maxMessagesPerWindow),
        windowSeconds: Math.max(3, next.windowSeconds),
        duplicateThreshold: Math.max(2, next.duplicateThreshold),
        blockAtAll: next.blockAtAll ? 1 : 0,
        actionType: next.actionType,
        muteHours: Math.max(1, next.muteHours),
      })
      .onDuplicateKeyUpdate({
        set: {
          enabled: next.enabled ? 1 : 0,
          maxMessagesPerWindow: Math.max(2, next.maxMessagesPerWindow),
          windowSeconds: Math.max(3, next.windowSeconds),
          duplicateThreshold: Math.max(2, next.duplicateThreshold),
          blockAtAll: next.blockAtAll ? 1 : 0,
          actionType: next.actionType,
          muteHours: Math.max(1, next.muteHours),
          updatedAt: new Date(),
        },
      })

    return this.getRule(guildId)
  }

  async listWhitelist(guildId: string) {
    return this.ctx.db.drizzle
      .select()
      .from(pluginAntiSpamWhitelist)
      .where(and(
        eq(pluginAntiSpamWhitelist.tenantId, this.ctx.tenantId),
        eq(pluginAntiSpamWhitelist.guildId, guildId),
      ))
      .orderBy(desc(pluginAntiSpamWhitelist.createdAt))
  }

  async addWhitelist(guildId: string, userId: string) {
    await this.ctx.db.drizzle
      .insert(pluginAntiSpamWhitelist)
      .values({
        tenantId: this.ctx.tenantId,
        guildId,
        userId,
      })
      .onDuplicateKeyUpdate({ set: { createdAt: new Date() } })
  }

  async removeWhitelist(guildId: string, userId: string) {
    const result = await this.ctx.db.drizzle
      .delete(pluginAntiSpamWhitelist)
      .where(and(
        eq(pluginAntiSpamWhitelist.tenantId, this.ctx.tenantId),
        eq(pluginAntiSpamWhitelist.guildId, guildId),
        eq(pluginAntiSpamWhitelist.userId, userId),
      ))
    return (result as any)?.affectedRows ?? 0
  }

  async listViolations(guildId: string, page = 1, size = 20) {
    const limit = Math.min(100, Math.max(1, size))
    const offset = (Math.max(1, page) - 1) * limit
    const rows = await this.ctx.db.drizzle
      .select()
      .from(pluginAntiSpamViolations)
      .where(and(
        eq(pluginAntiSpamViolations.tenantId, this.ctx.tenantId),
        eq(pluginAntiSpamViolations.guildId, guildId),
      ))
      .orderBy(desc(pluginAntiSpamViolations.createdAt))
      .limit(limit)
      .offset(offset)

    return { rows, page: Math.max(1, page), size: limit }
  }

  private async isWhitelisted(guildId: string, userId: string): Promise<boolean> {
    const [row] = await this.ctx.db.drizzle
      .select({ id: pluginAntiSpamWhitelist.id })
      .from(pluginAntiSpamWhitelist)
      .where(and(
        eq(pluginAntiSpamWhitelist.tenantId, this.ctx.tenantId),
        eq(pluginAntiSpamWhitelist.guildId, guildId),
        eq(pluginAntiSpamWhitelist.userId, userId),
      ))
      .limit(1)

    return !!row
  }

  private normalizeContent(content: string): string {
    return content.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200)
  }

  private async detect(rule: RuleSnapshot, guildId: string, userId: string, content: string): Promise<DetectResult> {
    const windowKey = `anti-spam:window:${guildId}:${userId}`
    const messageCount = await this.ctx.redis.incr(windowKey)
    if (messageCount === 1) {
      await this.ctx.redis.expire(windowKey, Math.max(3, rule.windowSeconds))
    }

    if (messageCount > rule.maxMessagesPerWindow) {
      return {
        violated: true,
        trigger: 'high_frequency',
        detail: `窗口内消息过多(${messageCount}/${rule.maxMessagesPerWindow})`,
      }
    }

    const normalized = this.normalizeContent(content)
    const contentKey = `anti-spam:last:${guildId}:${userId}`
    const lastContent = await this.ctx.redis.hget(contentKey, 'content')
    let duplicateCount = Number(await this.ctx.redis.hget(contentKey, 'count') || '0')

    if (lastContent && lastContent === normalized) {
      duplicateCount += 1
    } else {
      duplicateCount = 1
    }

    await this.ctx.redis.hset(contentKey, 'content', normalized)
    await this.ctx.redis.hset(contentKey, 'count', String(duplicateCount))
    await this.ctx.redis.expire(contentKey, Math.max(3, rule.windowSeconds * 2))

    if (duplicateCount >= rule.duplicateThreshold) {
      return {
        violated: true,
        trigger: 'duplicate',
        detail: `重复消息次数过多(${duplicateCount}/${rule.duplicateThreshold})`,
      }
    }

    if (rule.blockAtAll && /(met\)all\(met|@全体|@everyone)/i.test(content)) {
      return {
        violated: true,
        trigger: 'at_all',
        detail: '触发全体提及防刷规则',
      }
    }

    return { violated: false }
  }

  private async recordViolation(input: {
    guildId: string
    userId: string
    trigger: TriggerType
    content: string
    actionTaken: string
  }) {
    await this.ctx.db.drizzle
      .insert(pluginAntiSpamViolations)
      .values({
        tenantId: this.ctx.tenantId,
        guildId: input.guildId,
        userId: input.userId,
        type: input.trigger,
        content: input.content.slice(0, 500),
        actionTaken: input.actionTaken,
      })
  }

  private async takeAction(rule: RuleSnapshot, event: KookEvent, trigger: TriggerType, detail: string) {
    const guildId = event.extra?.guild_id || String(event.extra?.body?.guild_id || '')
    const channelId = event.target_id
    const userId = event.author_id || String(event.extra?.body?.user_id || '')
    const msgId = event.msg_id
    const correlationId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    if (!guildId || !channelId || !userId) {
      return { actionTaken: 'skipped', message: '缺少事件上下文' }
    }

    if (rule.actionType === 'delete') {
      if (msgId) {
        await this.ctx.kookApi.deleteMessage(msgId)
      }
      await this.ctx.kookApi.sendChannelMessage(channelId, `已拦截刷屏消息 <@${userId}> (${detail})`)
      await this.recordViolation({ guildId, userId, trigger, content: event.content || '', actionTaken: 'delete' })
      return { actionTaken: 'delete', message: detail }
    }

    if (rule.actionType === 'mute') {
      let muted = false
      let muteError = ''
      const moderationService = this.ctx.getPluginService<{ muteUser: (userId: string, guildId: string, hours: number, mutedBy: string) => Promise<void> }>('moderation')
      if (moderationService) {
        try {
          await moderationService.muteUser(userId, guildId, Math.max(1, rule.muteHours), 'anti-spam')
          muted = true
        } catch (err: any) {
          muteError = err?.message || 'moderation.mute_user failed'
          this.ctx.logger.error(`anti-spam mute 降级 [${correlationId}] guild=${guildId} user=${userId}: ${muteError}`)
        }
      } else {
        muteError = 'moderation service unavailable'
        this.ctx.logger.warn(`anti-spam mute 降级 [${correlationId}] guild=${guildId} user=${userId}: moderation service unavailable`)
      }

      if (msgId) {
        await this.ctx.kookApi.deleteMessage(msgId)
      }

      if (muted) {
        await this.ctx.kookApi.sendChannelMessage(channelId, `已对 <@${userId}> 执行反刷屏禁言 ${Math.max(1, rule.muteHours)} 小时 (${detail})`)
        await this.recordViolation({ guildId, userId, trigger, content: event.content || '', actionTaken: 'mute' })
        return { actionTaken: 'mute', message: detail }
      }

      await this.ctx.kookApi.sendChannelMessage(channelId, `<@${userId}> 触发反刷屏规则，已降级为警告（追踪ID: ${correlationId}）`)
      await this.recordViolation({
        guildId,
        userId,
        trigger,
        content: `${(event.content || '').slice(0, 400)} | mute_degraded:${muteError || 'unknown'} | cid:${correlationId}`,
        actionTaken: 'mute_degraded',
      })
      return { actionTaken: 'mute_degraded', message: `${detail}; mute degraded` }
    }

    await this.ctx.kookApi.sendChannelMessage(channelId, `<@${userId}> 请勿刷屏 (${detail})`)
    await this.recordViolation({ guildId, userId, trigger, content: event.content || '', actionTaken: 'warn' })
    return { actionTaken: 'warn', message: detail }
  }

  async handleMessage(event: KookEvent) {
    if (event.type !== 1 && event.type !== 9 && event.type !== 10) {
      return { blocked: false }
    }

    if (event.extra?.author?.bot) {
      return { blocked: false }
    }

    const guildId = event.extra?.guild_id || String(event.extra?.body?.guild_id || '')
    const userId = event.author_id || String(event.extra?.body?.user_id || '')
    const content = String(event.content || '')

    if (!guildId || !userId || !content.trim()) {
      return { blocked: false }
    }

    if (await this.isWhitelisted(guildId, userId)) {
      return { blocked: false }
    }

    const rule = await this.getRule(guildId)
    if (!rule.enabled) {
      return { blocked: false }
    }

    const detected = await this.detect(rule, guildId, userId, content)
    if (!detected.violated || !detected.trigger) {
      return { blocked: false }
    }

    const actionResult = await this.takeAction(rule, event, detected.trigger, detected.detail || '触发反刷屏规则')
    return {
      blocked: true,
      trigger: detected.trigger,
      detail: detected.detail,
      actionTaken: actionResult.actionTaken,
    }
  }
}
