import { and, count, desc, eq, sql } from 'drizzle-orm'
import { getChinaDate } from '@kook-saas/shared'
import type { PluginContext } from '@kook-saas/shared'
import { pluginQuestsTemplates, pluginQuestsProgress } from './schema.js'

function normalizeDateKey(dateKey?: string): string {
  return dateKey || getChinaDate()
}

export class QuestsService {
  constructor(private ctx: PluginContext) {}

  async createTemplate(input: {
    guildId: string
    code: string
    title: string
    description?: string
    targetCount?: number
    rewardPoints?: number
    enabled?: boolean
  }) {
    const [result] = await this.ctx.db.drizzle
      .insert(pluginQuestsTemplates)
      .values({
        tenantId: this.ctx.tenantId,
        guildId: input.guildId,
        code: input.code.trim(),
        title: input.title.trim(),
        description: input.description || null,
        targetCount: Math.max(1, input.targetCount ?? 10),
        rewardPoints: Math.max(1, input.rewardPoints ?? 10),
        enabled: input.enabled === false ? 0 : 1,
      })
      .$returningId()

    return result.id
  }

  async listTemplates(guildId: string) {
    return this.ctx.db.drizzle
      .select()
      .from(pluginQuestsTemplates)
      .where(and(
        eq(pluginQuestsTemplates.tenantId, this.ctx.tenantId),
        eq(pluginQuestsTemplates.guildId, guildId),
      ))
      .orderBy(desc(pluginQuestsTemplates.updatedAt))
  }

  async setTemplateEnabled(templateId: number, enabled: boolean) {
    const result = await this.ctx.db.drizzle
      .update(pluginQuestsTemplates)
      .set({ enabled: enabled ? 1 : 0 })
      .where(and(
        eq(pluginQuestsTemplates.tenantId, this.ctx.tenantId),
        eq(pluginQuestsTemplates.id, templateId),
      ))
    return (result as any)?.affectedRows ?? 0
  }

  async upsertProgress(input: {
    guildId: string
    userId: string
    questCode: string
    progress: number
    claimed?: boolean
    dateKey?: string
  }) {
    const dateKey = normalizeDateKey(input.dateKey)

    await this.ctx.db.drizzle
      .insert(pluginQuestsProgress)
      .values({
        tenantId: this.ctx.tenantId,
        guildId: input.guildId,
        userId: input.userId,
        questCode: input.questCode,
        dateKey,
        progress: Math.max(0, Math.floor(input.progress)),
        claimed: input.claimed ? 1 : 0,
      })
      .onDuplicateKeyUpdate({
        set: {
          progress: Math.max(0, Math.floor(input.progress)),
          claimed: input.claimed ? 1 : 0,
          updatedAt: new Date(),
        },
      })

    return { success: true }
  }

  async incrementProgress(input: {
    guildId: string
    userId: string
    questCode: string
    amount?: number
    dateKey?: string
  }) {
    const dateKey = normalizeDateKey(input.dateKey)
    const amount = Math.max(1, Math.floor(input.amount ?? 1))

    const [template] = await this.ctx.db.drizzle
      .select()
      .from(pluginQuestsTemplates)
      .where(and(
        eq(pluginQuestsTemplates.tenantId, this.ctx.tenantId),
        eq(pluginQuestsTemplates.guildId, input.guildId),
        eq(pluginQuestsTemplates.code, input.questCode),
        eq(pluginQuestsTemplates.enabled, 1),
      ))
      .limit(1)

    if (!template) {
      return { success: false, message: '任务不存在或未启用' }
    }

    await this.ctx.db.drizzle
      .insert(pluginQuestsProgress)
      .values({
        tenantId: this.ctx.tenantId,
        guildId: input.guildId,
        userId: input.userId,
        questCode: input.questCode,
        dateKey,
        progress: amount,
        claimed: 0,
      })
      .onDuplicateKeyUpdate({
        set: {
          progress: sql`progress + ${amount}`,
          updatedAt: new Date(),
        },
      })

    return { success: true }
  }

  async getUserProgress(guildId: string, userId: string, dateKey?: string) {
    const day = normalizeDateKey(dateKey)
    const [templates, progressRows] = await Promise.all([
      this.ctx.db.drizzle
        .select()
        .from(pluginQuestsTemplates)
        .where(and(
          eq(pluginQuestsTemplates.tenantId, this.ctx.tenantId),
          eq(pluginQuestsTemplates.guildId, guildId),
          eq(pluginQuestsTemplates.enabled, 1),
        )),
      this.ctx.db.drizzle
        .select()
        .from(pluginQuestsProgress)
        .where(and(
          eq(pluginQuestsProgress.tenantId, this.ctx.tenantId),
          eq(pluginQuestsProgress.guildId, guildId),
          eq(pluginQuestsProgress.userId, userId),
          eq(pluginQuestsProgress.dateKey, day),
        )),
    ])

    const progressMap = new Map(progressRows.map((row: any) => [row.questCode, row]))
    return templates.map((tpl: any) => {
      const row = progressMap.get(tpl.code) as any
      const progress = row?.progress ?? 0
      const completed = progress >= tpl.targetCount
      return {
        code: tpl.code,
        title: tpl.title,
        description: tpl.description,
        targetCount: tpl.targetCount,
        rewardPoints: tpl.rewardPoints,
        progress,
        claimed: (row?.claimed ?? 0) === 1,
        completed,
      }
    })
  }

  async claimReward(guildId: string, userId: string, questCode: string, dateKey?: string) {
    const day = normalizeDateKey(dateKey)

    const [template] = await this.ctx.db.drizzle
      .select()
      .from(pluginQuestsTemplates)
      .where(and(
        eq(pluginQuestsTemplates.tenantId, this.ctx.tenantId),
        eq(pluginQuestsTemplates.guildId, guildId),
        eq(pluginQuestsTemplates.code, questCode),
        eq(pluginQuestsTemplates.enabled, 1),
      ))
      .limit(1)
    if (!template) return { success: false, message: '任务不存在' }

    const [progress] = await this.ctx.db.drizzle
      .select()
      .from(pluginQuestsProgress)
      .where(and(
        eq(pluginQuestsProgress.tenantId, this.ctx.tenantId),
        eq(pluginQuestsProgress.guildId, guildId),
        eq(pluginQuestsProgress.userId, userId),
        eq(pluginQuestsProgress.questCode, questCode),
        eq(pluginQuestsProgress.dateKey, day),
      ))
      .limit(1)

    if (!progress) return { success: false, message: '暂无任务进度' }
    if ((progress as any).claimed === 1) return { success: false, message: '奖励已领取' }
    if ((progress as any).progress < (template as any).targetCount) return { success: false, message: '任务未完成' }

    const claimResult = await this.ctx.db.drizzle
      .update(pluginQuestsProgress)
      .set({ claimed: 1, updatedAt: new Date() })
      .where(and(
        eq(pluginQuestsProgress.tenantId, this.ctx.tenantId),
        eq(pluginQuestsProgress.guildId, guildId),
        eq(pluginQuestsProgress.userId, userId),
        eq(pluginQuestsProgress.questCode, questCode),
        eq(pluginQuestsProgress.dateKey, day),
        eq(pluginQuestsProgress.claimed, 0),
      ))

    const affectedRows = (claimResult as any)?.affectedRows ?? 0
    if (affectedRows === 0) {
      return { success: false, message: '奖励已领取' }
    }

    const pointsService = this.ctx.getPluginService<{ addUserPoints: (userId: string, guildId: string, amount: number, reason?: string) => Promise<number> }>('points')
    if (!pointsService) {
      await this.ctx.db.drizzle
        .update(pluginQuestsProgress)
        .set({ claimed: 0, updatedAt: new Date() })
        .where(and(
          eq(pluginQuestsProgress.tenantId, this.ctx.tenantId),
          eq(pluginQuestsProgress.guildId, guildId),
          eq(pluginQuestsProgress.userId, userId),
          eq(pluginQuestsProgress.questCode, questCode),
          eq(pluginQuestsProgress.dateKey, day),
        ))
      return { success: false, message: '积分插件未启用' }
    }

    try {
      await pointsService.addUserPoints(userId, guildId, (template as any).rewardPoints, `任务奖励:${questCode}`)
      return { success: true, rewardPoints: (template as any).rewardPoints }
    } catch (err: any) {
      await this.ctx.db.drizzle
        .update(pluginQuestsProgress)
        .set({ claimed: 0, updatedAt: new Date() })
        .where(and(
          eq(pluginQuestsProgress.tenantId, this.ctx.tenantId),
          eq(pluginQuestsProgress.guildId, guildId),
          eq(pluginQuestsProgress.userId, userId),
          eq(pluginQuestsProgress.questCode, questCode),
          eq(pluginQuestsProgress.dateKey, day),
        ))
      return { success: false, message: err?.message || '奖励发放失败，请稍后重试' }
    }
  }

  async getLeaderboard(guildId: string, dateKey?: string, limit = 20) {
    const day = normalizeDateKey(dateKey)
    const rows = await this.ctx.db.drizzle
      .select({ userId: pluginQuestsProgress.userId, claimedCount: count() })
      .from(pluginQuestsProgress)
      .where(and(
        eq(pluginQuestsProgress.tenantId, this.ctx.tenantId),
        eq(pluginQuestsProgress.guildId, guildId),
        eq(pluginQuestsProgress.dateKey, day),
        eq(pluginQuestsProgress.claimed, 1),
      ))
      .groupBy(pluginQuestsProgress.userId)

    return rows
      .sort((a: any, b: any) => Number(b.claimedCount || 0) - Number(a.claimedCount || 0))
      .slice(0, limit)
      .map((row: any) => ({ userId: row.userId, claimedCount: Number(row.claimedCount || 0) }))
  }
}
