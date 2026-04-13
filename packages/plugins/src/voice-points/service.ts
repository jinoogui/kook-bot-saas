import { eq, and, sql } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { getChinaDate } from '@kook-saas/shared'
import { pluginVoiceOnlineRecords, pluginVoicePointsDaily } from './schema.js'
import { pluginPointsUserPoints } from '../points/schema.js'

// ── 默认配置 ─────────────────────────────────────────
const DEFAULT_PER_HOUR = 1
const DEFAULT_DAILY_LIMIT = 10

// ── Redis key 模板（ScopedRedis 已自动加 tenant 前缀）──
const KEY_JOIN_TIME  = (uid: string, gid: string, cid: string) => `vp:join:${uid}:${gid}:${cid}`
const KEY_ACCUMULATED = (uid: string, gid: string, cid: string) => `vp:acc:${uid}:${gid}:${cid}`
const KEY_ONLINE_SET  = (gid: string) => `vp:online:${gid}`

export class VoicePointsService {
  private readonly db: any
  private readonly tenantId: string

  constructor(private ctx: PluginContext) {
    this.db = ctx.db.drizzle
    this.tenantId = ctx.db.tenantId
  }

  // ════════════════════════════════════════════════════
  //  配置读取
  // ════════════════════════════════════════════════════

  private async getConfig() {
    const config = await this.ctx.getConfig()
    const enabled    = config.enabled === true || config.enabled === 'true'
    const perHour    = this._toInt(config.per_hour, DEFAULT_PER_HOUR)
    const dailyLimit = this._toInt(config.daily_limit, DEFAULT_DAILY_LIMIT)
    return { enabled, perHour, dailyLimit }
  }

  private _toInt(val: any, def: number): number {
    if (val === undefined || val === null) return def
    const n = typeof val === 'number' ? val : parseInt(String(val))
    return isNaN(n) ? def : n
  }

  // ════════════════════════════════════════════════════
  //  用户加入语音频道
  // ════════════════════════════════════════════════════

  async onUserJoin(userId: string, guildId: string, channelId: string) {
    const config = await this.getConfig()
    if (!config.enabled) return

    const joinKey = KEY_JOIN_TIME(userId, guildId, channelId)

    // ScopedRedis 没有 exists，用 get 判断
    const existing = await this.ctx.redis.get(joinKey)
    if (existing !== null) return // 重复事件

    const now = Date.now()
    await this.ctx.redis.set(joinKey, String(now))
    await this.ctx.redis.set(KEY_ACCUMULATED(userId, guildId, channelId), '0')
    await this.ctx.redis.sadd(KEY_ONLINE_SET(guildId), `${userId}:${channelId}`)

    await this.db.insert(pluginVoiceOnlineRecords).values({
      tenantId: this.tenantId,
      userId,
      guildId,
      channelId,
      joinTime: new Date(now),
    })

    this.ctx.logger.info(`[语音积分] 用户 ${userId} 加入频道 ${channelId} (guild=${guildId})`)
  }

  // ════════════════════════════════════════════════════
  //  用户离开语音频道
  // ════════════════════════════════════════════════════

  async onUserLeave(userId: string, guildId: string, channelId: string) {
    const joinKey = KEY_JOIN_TIME(userId, guildId, channelId)
    const accKey  = KEY_ACCUMULATED(userId, guildId, channelId)

    const joinTimeStr = await this.ctx.redis.get(joinKey)
    if (!joinTimeStr) return // 未追踪

    const config = await this.getConfig()

    await this.ctx.redis.del(joinKey)
    const accumulated = parseInt((await this.ctx.redis.get(accKey)) ?? '0')
    await this.ctx.redis.del(accKey)
    await this.ctx.redis.srem(KEY_ONLINE_SET(guildId), `${userId}:${channelId}`)

    const now = Date.now()
    const lastSegment = Math.max(0, Math.floor((now - parseInt(joinTimeStr)) / 1000))
    const totalSession = accumulated + lastSegment

    if (config.enabled) {
      await this._awardPoints(userId, guildId, lastSegment, config)
    }

    const daily = await this._getDailyPoints(userId, guildId)
    await this.db
      .update(pluginVoiceOnlineRecords)
      .set({
        leaveTime: new Date(now),
        durationSeconds: totalSession,
        pointsAwarded: daily.pointsEarned,
      })
      .where(
        and(
          eq(pluginVoiceOnlineRecords.tenantId, this.tenantId),
          eq(pluginVoiceOnlineRecords.userId, userId),
          eq(pluginVoiceOnlineRecords.guildId, guildId),
          eq(pluginVoiceOnlineRecords.channelId, channelId),
          sql`${pluginVoiceOnlineRecords.leaveTime} IS NULL`,
        ),
      )

    const h = Math.floor(totalSession / 3600)
    const m = Math.floor((totalSession % 3600) / 60)
    this.ctx.logger.info(`[语音积分] 用户 ${userId} 离开频道 ${channelId}, 时长=${h}h${m}m`)
  }

  // ════════════════════════════════════════════════════
  //  周期性结算（每5分钟由 Timer 触发）
  // ════════════════════════════════════════════════════

  async periodicSettle() {
    // ScopedRedis.keys 返回带 tenant 前缀的完整 key
    // 例如 tenant:xxx:vp:join:userId:guildId:channelId
    const allKeys = await this.ctx.redis.keys('vp:join:*')
    const now = Date.now()

    this.ctx.logger.info(`[语音积分] 周期结算开始，在线用户数=${allKeys.length}`)
    if (!allKeys.length) return

    for (const fullKey of allKeys) {
      try {
        // 从完整 key 中提取逻辑部分：找到 vp:join: 的位置
        const vpIdx = fullKey.indexOf('vp:join:')
        if (vpIdx === -1) continue
        const logicalKey = fullKey.substring(vpIdx)
        const parts = logicalKey.split(':')
        // logicalKey format: vp:join:userId:guildId:channelId
        const [, , userId, guildId, channelId] = parts
        if (!userId || !guildId || !channelId) continue

        const joinKey = KEY_JOIN_TIME(userId, guildId, channelId)
        const joinTimeStr = await this.ctx.redis.get(joinKey)
        if (!joinTimeStr) continue

        const config = await this.getConfig()
        if (!config.enabled) continue

        const increment = Math.max(0, Math.floor((now - parseInt(joinTimeStr)) / 1000))
        if (increment < 10) continue // 不足10秒不结算

        const awarded = await this._awardPoints(userId, guildId, increment, config)

        // 累加时长（ScopedRedis 没有 incrby，用 get + set 替代）
        const accKey = KEY_ACCUMULATED(userId, guildId, channelId)
        const currentAcc = parseInt((await this.ctx.redis.get(accKey)) ?? '0')
        const newAcc = currentAcc + increment
        await this.ctx.redis.set(accKey, String(newAcc))

        // 重置 joinTime
        await this.ctx.redis.set(joinKey, String(now))

        // 更新数据库在线记录
        const daily = await this._getDailyPoints(userId, guildId)
        await this.db
          .update(pluginVoiceOnlineRecords)
          .set({
            durationSeconds: newAcc + increment,
            pointsAwarded: daily.pointsEarned,
          })
          .where(
            and(
              eq(pluginVoiceOnlineRecords.tenantId, this.tenantId),
              eq(pluginVoiceOnlineRecords.userId, userId),
              eq(pluginVoiceOnlineRecords.guildId, guildId),
              eq(pluginVoiceOnlineRecords.channelId, channelId),
              sql`${pluginVoiceOnlineRecords.leaveTime} IS NULL`,
            ),
          )

        if (awarded > 0) {
          this.ctx.logger.info(
            `[语音积分] 结算: 用户 ${userId} 增量=${increment}s 获得=${awarded}分 (guild=${guildId})`,
          )
        }
      } catch (err) {
        this.ctx.logger.error(`[语音积分] 结算 ${fullKey} 失败:`, err)
      }
    }
  }

  // ════════════════════════════════════════════════════
  //  启动恢复（处理未关闭的记录）
  // ════════════════════════════════════════════════════

  async recoverOnStartup() {
    const unclosed = await this.db
      .select()
      .from(pluginVoiceOnlineRecords)
      .where(
        and(
          eq(pluginVoiceOnlineRecords.tenantId, this.tenantId),
          sql`${pluginVoiceOnlineRecords.leaveTime} IS NULL`,
        ),
      )

    if (!unclosed.length) {
      this.ctx.logger.info('[语音积分] 无需恢复的语音记录')
      return
    }

    this.ctx.logger.info(`[语音积分] 发现 ${unclosed.length} 条未关闭记录，开始恢复结算`)
    const now = new Date()

    for (const record of unclosed) {
      try {
        const joinTime = new Date(record.joinTime)
        const prevDuration = record.durationSeconds ?? 0
        const totalDuration = Math.max(0, Math.floor((now.getTime() - joinTime.getTime()) / 1000))
        const increment = Math.max(0, totalDuration - prevDuration)

        await this._awardPoints(record.userId, record.guildId, increment)

        const daily = await this._getDailyPoints(record.userId, record.guildId)
        await this.db
          .update(pluginVoiceOnlineRecords)
          .set({
            leaveTime: now,
            durationSeconds: totalDuration,
            pointsAwarded: daily.pointsEarned,
          })
          .where(eq(pluginVoiceOnlineRecords.id, record.id))

        this.ctx.logger.info(`[语音积分] 恢复: 用户 ${record.userId}, 增量=${increment}s`)
      } catch (err) {
        this.ctx.logger.error(`[语音积分] 恢复记录 ${record.id} 失败:`, err)
      }
    }
  }

  // ════════════════════════════════════════════════════
  //  查询未结算增量（当前在线时长）
  // ════════════════════════════════════════════════════

  async getUnSettledDuration(userId: string, guildId: string): Promise<number> {
    const allKeys = await this.ctx.redis.keys(`vp:join:${userId}:${guildId}:*`)
    if (!allKeys.length) return 0

    // keys 返回的是带 tenant 前缀的完整 key，需要提取逻辑 key
    const fullKey = allKeys[0]
    const vpIdx = fullKey.indexOf('vp:join:')
    if (vpIdx === -1) return 0
    const logicalKey = fullKey.substring(vpIdx)

    const joinTimeStr = await this.ctx.redis.get(logicalKey)
    if (!joinTimeStr) return 0
    return Math.max(0, Math.floor((Date.now() - parseInt(joinTimeStr)) / 1000))
  }

  // ════════════════════════════════════════════════════
  //  内部：结算积分
  // ════════════════════════════════════════════════════

  private async _awardPoints(
    userId: string,
    guildId: string,
    increment: number,
    config?: { enabled: boolean; perHour: number; dailyLimit: number },
  ): Promise<number> {
    if (!config) config = await this.getConfig()

    const daily = await this._getDailyPoints(userId, guildId)
    const newTotalSeconds = daily.totalSeconds + increment
    const totalDeserved = Math.floor(newTotalSeconds / 3600) * config.perHour
    const toAward = Math.max(
      0,
      Math.min(totalDeserved - daily.pointsEarned, config.dailyLimit - daily.pointsEarned),
    )

    if (toAward > 0) {
      // 使用 points 插件的 userPoints 表发放积分
      await this.db
        .insert(pluginPointsUserPoints)
        .values({
          tenantId: this.tenantId,
          userId,
          guildId,
          points: toAward,
          totalEarned: toAward,
        })
        .onDuplicateKeyUpdate({
          set: {
            points:      sql`points + ${toAward}`,
            totalEarned: sql`total_earned + ${toAward}`,
          },
        })
      this.ctx.logger.info(`[语音积分] 用户 ${userId} 获得 ${toAward} 积分`)
    }

    // 更新每日汇总
    const date = getChinaDate()
    await this.db
      .insert(pluginVoicePointsDaily)
      .values({
        tenantId: this.tenantId,
        userId,
        guildId,
        date,
        totalSeconds: newTotalSeconds,
        pointsEarned: daily.pointsEarned + toAward,
      })
      .onDuplicateKeyUpdate({
        set: {
          totalSeconds: newTotalSeconds,
          pointsEarned: daily.pointsEarned + toAward,
        },
      })

    return toAward
  }

  private async _getDailyPoints(userId: string, guildId: string) {
    const date = getChinaDate()
    const [row] = await this.db
      .select()
      .from(pluginVoicePointsDaily)
      .where(
        and(
          eq(pluginVoicePointsDaily.tenantId, this.tenantId),
          eq(pluginVoicePointsDaily.userId, userId),
          eq(pluginVoicePointsDaily.guildId, guildId),
          eq(pluginVoicePointsDaily.date, date),
        ),
      )
      .limit(1)
    return {
      totalSeconds: row?.totalSeconds ?? 0,
      pointsEarned: row?.pointsEarned ?? 0,
    }
  }
}
