import { eq, and, desc, sql } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { getChinaDate } from '@kook-saas/shared'
import {
  pluginPointsUserPoints,
  pluginPointsCheckinRecords,
  pluginPointsShopItems,
  pluginPointsShopExchanges,
  pluginPointsRewardRecords,
} from './schema.js'

// ── 配置默认值 ─────────────────────────────────────
const DEFAULTS = {
  checkin_min_points:     10,
  checkin_max_points:     50,
  checkin_streak_enabled: true,
  checkin_streak_min:     20,
  checkin_streak_max:     50,
  box_cost:              100,
  box_min_reward:         10,
  box_max_reward:        200,
  box_cooldown:         3600,
}

export interface CheckinResult {
  alreadyCheckin: boolean
  streak:         number
  currentPoints:  number
  basePoints?:    number
  bonusPoints?:   number
  totalPoints?:   number
}

export class PointsService {
  private readonly db: any
  private readonly tenantId: string

  constructor(private ctx: PluginContext) {
    this.db = ctx.db.drizzle
    this.tenantId = ctx.tenantId
  }

  // ════════════════════════════════════════════════
  //  配置辅助
  // ════════════════════════════════════════════════

  private async getIntConfig(key: string, def: number): Promise<number> {
    const config = await this.ctx.getConfig()
    const v = config[key]
    if (v === undefined || v === null) return def
    const n = typeof v === 'number' ? v : parseInt(String(v))
    return isNaN(n) ? def : n
  }

  private async getBoolConfig(key: string, def: boolean): Promise<boolean> {
    const config = await this.ctx.getConfig()
    const v = config[key]
    if (v === undefined || v === null) return def
    if (typeof v === 'boolean') return v
    return String(v) === 'true'
  }

  // ════════════════════════════════════════════════
  //  积分核心
  // ════════════════════════════════════════════════

  async getUserPoints(userId: string, guildId: string): Promise<number> {
    const [row] = await this.db
      .select({ points: pluginPointsUserPoints.points })
      .from(pluginPointsUserPoints)
      .where(
        and(
          eq(pluginPointsUserPoints.tenantId, this.tenantId),
          eq(pluginPointsUserPoints.userId, userId),
          eq(pluginPointsUserPoints.guildId, guildId),
        ),
      )
      .limit(1)
    return row?.points ?? 0
  }

  async addUserPoints(
    userId: string,
    guildId: string,
    amount: number,
    reason: string = '',
  ): Promise<number> {
    await this.db
      .insert(pluginPointsUserPoints)
      .values({
        tenantId: this.tenantId,
        userId,
        guildId,
        points: amount,
        totalEarned: Math.max(0, amount),
      })
      .onDuplicateKeyUpdate({
        set: {
          points:      sql`points + ${amount}`,
          totalEarned: sql`total_earned + ${Math.max(0, amount)}`,
        },
      })

    if (reason) {
      await this.db.insert(pluginPointsRewardRecords).values({
        tenantId: this.tenantId,
        userId,
        guildId,
        rewardType:   'manual',
        rewardName:   reason,
        pointsEarned: amount,
      })
    }

    return this.getUserPoints(userId, guildId)
  }

  async deductUserPoints(
    userId: string,
    guildId: string,
    amount: number,
    reason: string = '',
  ): Promise<{ success: boolean; message: string; remaining: number }> {
    // Atomic deduction with balance check
    const result = await this.db
      .update(pluginPointsUserPoints)
      .set({ points: sql`points - ${amount}` })
      .where(and(
        eq(pluginPointsUserPoints.tenantId, this.tenantId),
        eq(pluginPointsUserPoints.userId, userId),
        eq(pluginPointsUserPoints.guildId, guildId),
        sql`points >= ${amount}`,
      ))

    if ((result as any)[0]?.affectedRows === 0 || (result as any).affectedRows === 0) {
      const current = await this.getUserPoints(userId, guildId)
      return {
        success: false,
        message: `积分不足，当前 ${current} 分，需要 ${amount} 分`,
        remaining: current,
      }
    }

    if (reason) {
      await this.db.insert(pluginPointsRewardRecords).values({
        tenantId: this.tenantId,
        userId,
        guildId,
        rewardType: 'deduct',
        rewardName: reason,
        pointsEarned: -amount,
      })
    }

    const remaining = await this.getUserPoints(userId, guildId)
    return { success: true, message: '扣除成功', remaining }
  }

  async getLeaderboard(guildId: string, limit = 10) {
    return this.db
      .select({
        userId: pluginPointsUserPoints.userId,
        points: pluginPointsUserPoints.points,
      })
      .from(pluginPointsUserPoints)
      .where(
        and(
          eq(pluginPointsUserPoints.tenantId, this.tenantId),
          eq(pluginPointsUserPoints.guildId, guildId),
        ),
      )
      .orderBy(desc(pluginPointsUserPoints.points))
      .limit(limit)
  }

  // ════════════════════════════════════════════════
  //  签到系统
  // ════════════════════════════════════════════════

  async checkCheckinToday(userId: string, guildId: string): Promise<boolean> {
    const today = getChinaDate()
    const [row] = await this.db
      .select({ id: pluginPointsCheckinRecords.id })
      .from(pluginPointsCheckinRecords)
      .where(
        and(
          eq(pluginPointsCheckinRecords.tenantId, this.tenantId),
          eq(pluginPointsCheckinRecords.userId, userId),
          eq(pluginPointsCheckinRecords.guildId, guildId),
          eq(pluginPointsCheckinRecords.checkinDate, today),
        ),
      )
      .limit(1)
    return !!row
  }

  async getConsecutiveDays(userId: string, guildId: string): Promise<number> {
    const records = await this.db
      .select({ date: pluginPointsCheckinRecords.checkinDate })
      .from(pluginPointsCheckinRecords)
      .where(
        and(
          eq(pluginPointsCheckinRecords.tenantId, this.tenantId),
          eq(pluginPointsCheckinRecords.userId, userId),
          eq(pluginPointsCheckinRecords.guildId, guildId),
        ),
      )
      .orderBy(desc(pluginPointsCheckinRecords.checkinDate))
      .limit(365)

    if (!records.length) return 0

    const today = getChinaDate()
    let streak = 0
    // Start from today; if today is not checked in, try yesterday
    let expected = today

    for (const record of records) {
      if (record.date === expected) {
        streak++
        const d = new Date(expected + 'T00:00:00+08:00')
        d.setTime(d.getTime() - 24 * 60 * 60 * 1000)
        expected = d.toISOString().slice(0, 10)
      } else if (streak === 0 && record.date !== today) {
        // User hasn't checked in today, try yesterday
        const yesterday = new Date(today + 'T00:00:00+08:00')
        yesterday.setTime(yesterday.getTime() - 24 * 60 * 60 * 1000)
        const yesterdayStr = yesterday.toISOString().slice(0, 10)
        if (record.date === yesterdayStr) {
          streak++
          const d = new Date(yesterdayStr + 'T00:00:00+08:00')
          d.setTime(d.getTime() - 24 * 60 * 60 * 1000)
          expected = d.toISOString().slice(0, 10)
        } else {
          break
        }
      } else {
        break
      }
    }
    return streak
  }

  async doCheckin(userId: string, guildId: string): Promise<CheckinResult> {
    // Read config first
    const minPts    = await this.getIntConfig('checkin_min_points',     DEFAULTS.checkin_min_points)
    const maxPts    = await this.getIntConfig('checkin_max_points',     DEFAULTS.checkin_max_points)
    const streakOn  = await this.getBoolConfig('checkin_streak_enabled', DEFAULTS.checkin_streak_enabled)
    const streakMin = await this.getIntConfig('checkin_streak_min',     DEFAULTS.checkin_streak_min)
    const streakMax = await this.getIntConfig('checkin_streak_max',     DEFAULTS.checkin_streak_max)

    const basePoints = minPts + Math.floor(Math.random() * (maxPts - minPts + 1))
    const streak = await this.getConsecutiveDays(userId, guildId)
    const newStreak = streak + 1
    let bonusPoints = 0
    if (streakOn && newStreak > 0 && newStreak % 7 === 0) {
      const min = Math.min(streakMin, streakMax)
      const max = Math.max(streakMin, streakMax)
      bonusPoints = min + Math.floor(Math.random() * (max - min + 1))
    }
    const totalPoints = basePoints + bonusPoints

    const today = getChinaDate()

    // Atomic insert - use ON DUPLICATE KEY UPDATE to detect duplicate
    const result = await this.db.insert(pluginPointsCheckinRecords).values({
      tenantId: this.tenantId,
      userId,
      guildId,
      checkinDate:  today,
      points:       basePoints,
      streakDays:   newStreak,
      bonusPoints,
    }).onDuplicateKeyUpdate({
      set: { points: pluginPointsCheckinRecords.points }, // no-op update
    })

    // If no row was actually inserted (duplicate), user already checked in
    if ((result as any)[0]?.affectedRows === 0 || (result as any).affectedRows === 0) {
      const points = await this.getUserPoints(userId, guildId)
      return { alreadyCheckin: true, streak, currentPoints: points }
    }

    // Award points
    await this.db
      .insert(pluginPointsUserPoints)
      .values({
        tenantId: this.tenantId,
        userId,
        guildId,
        points: totalPoints,
        totalEarned: totalPoints,
      })
      .onDuplicateKeyUpdate({
        set: {
          points:      sql`points + ${totalPoints}`,
          totalEarned: sql`total_earned + ${totalPoints}`,
        },
      })

    await this.db.insert(pluginPointsRewardRecords).values({
      tenantId: this.tenantId,
      userId,
      guildId,
      rewardType:   'checkin',
      rewardName:   '每日签到',
      pointsEarned: totalPoints,
    })

    const currentPoints = await this.getUserPoints(userId, guildId)
    return {
      alreadyCheckin: false,
      basePoints,
      bonusPoints,
      totalPoints,
      streak: newStreak,
      currentPoints,
    }
  }

  async getCheckinHistory(userId: string, guildId: string, limit = 30) {
    return this.db
      .select()
      .from(pluginPointsCheckinRecords)
      .where(
        and(
          eq(pluginPointsCheckinRecords.tenantId, this.tenantId),
          eq(pluginPointsCheckinRecords.userId, userId),
          eq(pluginPointsCheckinRecords.guildId, guildId),
        ),
      )
      .orderBy(desc(pluginPointsCheckinRecords.checkinDate))
      .limit(limit)
  }

  // ════════════════════════════════════════════════
  //  积分商店
  // ════════════════════════════════════════════════

  async getShopItems(guildId: string) {
    return this.db
      .select()
      .from(pluginPointsShopItems)
      .where(
        and(
          eq(pluginPointsShopItems.tenantId, this.tenantId),
          eq(pluginPointsShopItems.guildId, guildId),
          eq(pluginPointsShopItems.enabled, 1),
        ),
      )
      .orderBy(pluginPointsShopItems.price)
  }

  async buyShopItem(
    userId: string,
    guildId: string,
    itemId: number,
  ): Promise<{ success: boolean; message: string; item?: any }> {
    // 查询商品
    const [item] = await this.db
      .select()
      .from(pluginPointsShopItems)
      .where(
        and(
          eq(pluginPointsShopItems.id, itemId),
          eq(pluginPointsShopItems.tenantId, this.tenantId),
          eq(pluginPointsShopItems.guildId, guildId),
          eq(pluginPointsShopItems.enabled, 1),
        ),
      )
      .limit(1)

    if (!item) return { success: false, message: '商品不存在或已下架' }

    // 检查库存
    if (item.stock !== null && item.stock !== -1 && item.stock <= 0) {
      return { success: false, message: '商品库存不足' }
    }

    // 检查积分
    const deduct = await this.deductUserPoints(userId, guildId, item.price, `购买商品: ${item.name}`)
    if (!deduct.success) return { success: false, message: deduct.message }

    // Atomically decrement stock with condition
    if (item.stock !== null && item.stock !== -1) {
      const stockResult = await this.db
        .update(pluginPointsShopItems)
        .set({ stock: sql`stock - 1` })
        .where(and(
          eq(pluginPointsShopItems.id, itemId),
          sql`stock > 0`,
        ))
      // If no rows affected, stock was already 0
      if ((stockResult as any)[0]?.affectedRows === 0 || (stockResult as any).affectedRows === 0) {
        // Refund points
        await this.addUserPoints(userId, guildId, item.price, `退款: ${item.name} 库存不足`)
        return { success: false, message: '商品库存不足' }
      }
    }

    // 记录兑换
    await this.db.insert(pluginPointsShopExchanges).values({
      tenantId: this.tenantId,
      userId,
      guildId,
      itemId,
      itemName:  item.name,
      itemPrice: item.price,
    })

    return { success: true, message: '兑换成功', item }
  }

  async getUserExchanges(userId: string, guildId: string, limit = 20) {
    return this.db
      .select()
      .from(pluginPointsShopExchanges)
      .where(
        and(
          eq(pluginPointsShopExchanges.tenantId, this.tenantId),
          eq(pluginPointsShopExchanges.userId, userId),
          eq(pluginPointsShopExchanges.guildId, guildId),
        ),
      )
      .orderBy(desc(pluginPointsShopExchanges.createdAt))
      .limit(limit)
  }

  // ════════════════════════════════════════════════
  //  宝箱系统
  // ════════════════════════════════════════════════

  async openBox(
    userId: string,
    guildId: string,
  ): Promise<{ success: boolean; message: string; reward?: number }> {
    // 读取配置
    const cost   = await this.getIntConfig('box_cost',       DEFAULTS.box_cost)
    const minRew = await this.getIntConfig('box_min_reward', DEFAULTS.box_min_reward)
    const maxRew = await this.getIntConfig('box_max_reward', DEFAULTS.box_max_reward)

    // 检查冷却
    const [lastBox] = await this.db
      .select({ createdAt: pluginPointsRewardRecords.createdAt })
      .from(pluginPointsRewardRecords)
      .where(
        and(
          eq(pluginPointsRewardRecords.tenantId, this.tenantId),
          eq(pluginPointsRewardRecords.userId, userId),
          eq(pluginPointsRewardRecords.guildId, guildId),
          eq(pluginPointsRewardRecords.rewardType, 'box'),
        ),
      )
      .orderBy(desc(pluginPointsRewardRecords.createdAt))
      .limit(1)

    if (lastBox) {
      const cooldownSec = await this.getIntConfig('box_cooldown', DEFAULTS.box_cooldown)
      const elapsed = (Date.now() - new Date(lastBox.createdAt!).getTime()) / 1000
      if (elapsed < cooldownSec) {
        const remaining = Math.ceil(cooldownSec - elapsed)
        const mins = Math.floor(remaining / 60)
        const secs = remaining % 60
        return { success: false, message: `宝箱冷却中，还需等待 ${mins}分${secs}秒` }
      }
    }

    // 扣除积分
    const deduct = await this.deductUserPoints(userId, guildId, cost, '开启宝箱')
    if (!deduct.success) return { success: false, message: deduct.message }

    // 随机奖励
    const reward = minRew + Math.floor(Math.random() * (maxRew - minRew + 1))

    // 发放奖励
    await this.addUserPoints(userId, guildId, reward, '宝箱奖励')
    await this.db.insert(pluginPointsRewardRecords).values({
      tenantId: this.tenantId,
      userId,
      guildId,
      rewardType:   'box',
      rewardName:   '神秘宝箱',
      pointsEarned: reward,
    })

    return { success: true, message: '开启成功', reward }
  }
}
