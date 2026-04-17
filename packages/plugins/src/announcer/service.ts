import { and, count, desc, eq, lte } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { pluginAnnouncerTasks } from './schema.js'

export class AnnouncerService {
  constructor(private ctx: PluginContext) {}

  async createTask(input: {
    guildId: string
    channelId: string
    title: string
    content: string
    scheduleAt: Date
    createdBy: string
  }) {
    const [result] = await this.ctx.db.drizzle
      .insert(pluginAnnouncerTasks)
      .values({
        tenantId: this.ctx.tenantId,
        guildId: input.guildId,
        channelId: input.channelId,
        title: input.title.trim(),
        content: input.content,
        scheduleAt: input.scheduleAt,
        status: 'scheduled',
        retryCount: 0,
        createdBy: input.createdBy,
      })
      .$returningId()

    return result.id
  }

  async listTasks(guildId: string, params?: { status?: string; page?: number; size?: number }) {
    const page = Math.max(1, params?.page ?? 1)
    const size = Math.min(100, Math.max(1, params?.size ?? 20))
    const offset = (page - 1) * size

    const conditions = [
      eq(pluginAnnouncerTasks.tenantId, this.ctx.tenantId),
      eq(pluginAnnouncerTasks.guildId, guildId),
    ]
    if (params?.status) conditions.push(eq(pluginAnnouncerTasks.status, params.status))
    const whereExpr = and(...conditions)

    const [rows, [totalRow]] = await Promise.all([
      this.ctx.db.drizzle
        .select()
        .from(pluginAnnouncerTasks)
        .where(whereExpr)
        .orderBy(desc(pluginAnnouncerTasks.createdAt))
        .limit(size)
        .offset(offset),
      this.ctx.db.drizzle
        .select({ value: count() })
        .from(pluginAnnouncerTasks)
        .where(whereExpr),
    ])

    return { rows, total: totalRow?.value ?? 0, page, size }
  }

  async cancelTask(taskId: number) {
    const result = await this.ctx.db.drizzle
      .update(pluginAnnouncerTasks)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(
        eq(pluginAnnouncerTasks.tenantId, this.ctx.tenantId),
        eq(pluginAnnouncerTasks.id, taskId),
      ))

    return (result as any)?.affectedRows ?? 0
  }

  async getTask(taskId: number) {
    const [row] = await this.ctx.db.drizzle
      .select()
      .from(pluginAnnouncerTasks)
      .where(and(
        eq(pluginAnnouncerTasks.tenantId, this.ctx.tenantId),
        eq(pluginAnnouncerTasks.id, taskId),
      ))
      .limit(1)

    return row ?? null
  }

  async sendNow(taskId: number) {
    const task = await this.getTask(taskId)
    if (!task) return { success: false, message: '公告任务不存在' }

    try {
      await this.ctx.kookApi.sendChannelMessage(task.channelId, `【${task.title}】\n${task.content}`)
      await this.ctx.db.drizzle
        .update(pluginAnnouncerTasks)
        .set({ status: 'sent', lastError: null, updatedAt: new Date() })
        .where(and(
          eq(pluginAnnouncerTasks.tenantId, this.ctx.tenantId),
          eq(pluginAnnouncerTasks.id, taskId),
        ))
      return { success: true }
    } catch (err: any) {
      await this.ctx.db.drizzle
        .update(pluginAnnouncerTasks)
        .set({
          status: 'failed',
          retryCount: (task.retryCount ?? 0) + 1,
          lastError: err?.message || '发送失败',
          updatedAt: new Date(),
        })
        .where(and(
          eq(pluginAnnouncerTasks.tenantId, this.ctx.tenantId),
          eq(pluginAnnouncerTasks.id, taskId),
        ))
      return { success: false, message: err?.message || '发送失败' }
    }
  }

  async processScheduled() {
    const now = new Date()
    const config = await this.ctx.getConfig()
    const maxRetry = Math.max(0, Number(config.max_retry ?? 3))
    const retryDelayMinutes = Math.max(1, Number(config.retry_delay_minutes ?? 5))

    const rows = await this.ctx.db.drizzle
      .select()
      .from(pluginAnnouncerTasks)
      .where(and(
        eq(pluginAnnouncerTasks.tenantId, this.ctx.tenantId),
        eq(pluginAnnouncerTasks.status, 'scheduled'),
        lte(pluginAnnouncerTasks.scheduleAt, now),
      ))
      .limit(50)

    let sentCount = 0
    for (const row of rows as any[]) {
      try {
        await this.ctx.kookApi.sendChannelMessage(row.channelId, `【${row.title}】\n${row.content}`)
        await this.ctx.db.drizzle
          .update(pluginAnnouncerTasks)
          .set({ status: 'sent', lastError: null, updatedAt: new Date() })
          .where(and(
            eq(pluginAnnouncerTasks.tenantId, this.ctx.tenantId),
            eq(pluginAnnouncerTasks.id, row.id),
          ))
        sentCount += 1
      } catch (err: any) {
        const nextRetryCount = Number(row.retryCount ?? 0) + 1
        const finalStatus = nextRetryCount > maxRetry ? 'failed' : 'scheduled'
        const nextScheduleAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000)

        await this.ctx.db.drizzle
          .update(pluginAnnouncerTasks)
          .set({
            status: finalStatus,
            retryCount: nextRetryCount,
            lastError: err?.message || '发送失败',
            scheduleAt: finalStatus === 'scheduled' ? nextScheduleAt : row.scheduleAt,
            updatedAt: new Date(),
          })
          .where(and(
            eq(pluginAnnouncerTasks.tenantId, this.ctx.tenantId),
            eq(pluginAnnouncerTasks.id, row.id),
          ))
      }
    }

    return { sentCount, scanned: rows.length }
  }
}
