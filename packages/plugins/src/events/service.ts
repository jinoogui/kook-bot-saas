import { and, count, desc, eq, inArray, lte } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { pluginEventsItems, pluginEventsParticipants } from './schema.js'

export class EventsService {
  constructor(private ctx: PluginContext) {}

  async createEvent(input: {
    guildId: string
    channelId: string
    title: string
    description?: string
    startAt: Date
    endAt: Date
    maxParticipants?: number
    createdBy: string
  }) {
    const [result] = await this.ctx.db.drizzle
      .insert(pluginEventsItems)
      .values({
        tenantId: this.ctx.tenantId,
        guildId: input.guildId,
        channelId: input.channelId,
        title: input.title,
        description: input.description || null,
        startAt: input.startAt,
        endAt: input.endAt,
        maxParticipants: input.maxParticipants ?? 0,
        status: 'published',
        createdBy: input.createdBy,
      })
      .$returningId()
    return result.id
  }

  async listEvents(guildId: string, params?: { status?: string; page?: number; size?: number }) {
    const page = Math.max(1, params?.page ?? 1)
    const size = Math.min(100, Math.max(1, params?.size ?? 20))
    const offset = (page - 1) * size
    const conditions = [
      eq(pluginEventsItems.tenantId, this.ctx.tenantId),
      eq(pluginEventsItems.guildId, guildId),
    ]
    if (params?.status) conditions.push(eq(pluginEventsItems.status, params.status))
    const whereExpr = and(...conditions)

    const [rows, [totalRow]] = await Promise.all([
      this.ctx.db.drizzle
        .select()
        .from(pluginEventsItems)
        .where(whereExpr)
        .orderBy(desc(pluginEventsItems.createdAt))
        .limit(size)
        .offset(offset),
      this.ctx.db.drizzle
        .select({ value: count() })
        .from(pluginEventsItems)
        .where(whereExpr),
    ])

    return { rows, total: totalRow?.value ?? 0, page, size }
  }

  async getEvent(eventId: number) {
    const [row] = await this.ctx.db.drizzle
      .select()
      .from(pluginEventsItems)
      .where(and(
        eq(pluginEventsItems.tenantId, this.ctx.tenantId),
        eq(pluginEventsItems.id, eventId),
      ))
      .limit(1)
    return row ?? null
  }

  async joinEvent(eventId: number, guildId: string, userId: string) {
    const event = await this.getEvent(eventId)
    if (!event || event.guildId !== guildId) {
      return { success: false, message: '活动不存在' }
    }
    if (event.status !== 'published') {
      return { success: false, message: '活动不可报名' }
    }

    await this.ctx.db.drizzle
      .insert(pluginEventsParticipants)
      .values({
        tenantId: this.ctx.tenantId,
        eventId,
        guildId,
        userId,
        status: 'joined',
      })
      .onDuplicateKeyUpdate({
        set: {
          status: 'joined',
          joinedAt: new Date(),
        },
      })

    const [countRow] = await this.ctx.db.drizzle
      .select({ value: count() })
      .from(pluginEventsParticipants)
      .where(and(
        eq(pluginEventsParticipants.tenantId, this.ctx.tenantId),
        eq(pluginEventsParticipants.eventId, eventId),
        eq(pluginEventsParticipants.status, 'joined'),
      ))

    if ((event.maxParticipants ?? 0) > 0 && (countRow?.value ?? 0) > (event.maxParticipants ?? 0)) {
      await this.ctx.db.drizzle
        .update(pluginEventsParticipants)
        .set({ status: 'cancelled' })
        .where(and(
          eq(pluginEventsParticipants.tenantId, this.ctx.tenantId),
          eq(pluginEventsParticipants.eventId, eventId),
          eq(pluginEventsParticipants.userId, userId),
        ))
      return { success: false, message: '活动名额已满' }
    }

    return { success: true, message: '报名成功' }
  }

  async cancelJoin(eventId: number, guildId: string, userId: string) {
    const result = await this.ctx.db.drizzle
      .update(pluginEventsParticipants)
      .set({ status: 'cancelled' })
      .where(and(
        eq(pluginEventsParticipants.tenantId, this.ctx.tenantId),
        eq(pluginEventsParticipants.eventId, eventId),
        eq(pluginEventsParticipants.guildId, guildId),
        eq(pluginEventsParticipants.userId, userId),
      ))

    const affectedRows = (result as any)?.affectedRows ?? 0
    return affectedRows > 0
  }

  async listParticipants(eventId: number) {
    return this.ctx.db.drizzle
      .select()
      .from(pluginEventsParticipants)
      .where(and(
        eq(pluginEventsParticipants.tenantId, this.ctx.tenantId),
        eq(pluginEventsParticipants.eventId, eventId),
      ))
      .orderBy(desc(pluginEventsParticipants.joinedAt))
  }

  async closeEvent(eventId: number) {
    const result = await this.ctx.db.drizzle
      .update(pluginEventsItems)
      .set({ status: 'closed' })
      .where(and(
        eq(pluginEventsItems.tenantId, this.ctx.tenantId),
        eq(pluginEventsItems.id, eventId),
      ))
    return (result as any)?.affectedRows ?? 0
  }

  async processEventTimers() {
    const now = new Date()
    const [publishedRows, soonRows] = await Promise.all([
      this.ctx.db.drizzle
        .select()
        .from(pluginEventsItems)
        .where(and(
          eq(pluginEventsItems.tenantId, this.ctx.tenantId),
          eq(pluginEventsItems.status, 'published'),
          lte(pluginEventsItems.endAt, now),
        )),
      this.ctx.db.drizzle
        .select()
        .from(pluginEventsItems)
        .where(and(
          eq(pluginEventsItems.tenantId, this.ctx.tenantId),
          eq(pluginEventsItems.status, 'published'),
          eq(pluginEventsItems.reminderSent, 0),
        )),
    ])

    for (const event of publishedRows) {
      await this.ctx.db.drizzle
        .update(pluginEventsItems)
        .set({ status: 'closed' })
        .where(and(
          eq(pluginEventsItems.tenantId, this.ctx.tenantId),
          eq(pluginEventsItems.id, event.id),
        ))
    }

    const config = await this.ctx.getConfig()
    const reminderBeforeMinutes = Math.max(1, Number(config.reminder_before_minutes ?? 30))
    const remindThreshold = new Date(Date.now() + reminderBeforeMinutes * 60 * 1000)

    for (const event of soonRows) {
      if (!event.startAt) continue
      const startAt = new Date(event.startAt)
      if (startAt.getTime() > remindThreshold.getTime()) continue

      const joined = await this.ctx.db.drizzle
        .select({ userId: pluginEventsParticipants.userId })
        .from(pluginEventsParticipants)
        .where(and(
          eq(pluginEventsParticipants.tenantId, this.ctx.tenantId),
          eq(pluginEventsParticipants.eventId, event.id),
          eq(pluginEventsParticipants.status, 'joined'),
        ))

      const users = Array.from(new Set(joined.map((item: any) => item.userId).filter(Boolean)))
      for (const userId of users) {
        await this.ctx.kookApi.sendDirectMessage(String(userId), `活动「${event.title}」即将开始，时间：${startAt.toLocaleString('zh-CN')}`)
      }

      await this.ctx.db.drizzle
        .update(pluginEventsItems)
        .set({ reminderSent: 1 })
        .where(and(
          eq(pluginEventsItems.tenantId, this.ctx.tenantId),
          eq(pluginEventsItems.id, event.id),
        ))
    }
  }
}
