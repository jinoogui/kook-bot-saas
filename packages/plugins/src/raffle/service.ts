import { and, count, desc, eq, lte } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { pluginRaffleItems, pluginRaffleParticipants } from './schema.js'

export class RaffleService {
  constructor(private ctx: PluginContext) {}

  async createRaffle(input: {
    guildId: string
    channelId: string
    title: string
    prize: string
    drawAt: Date
    createdBy: string
  }) {
    const [result] = await this.ctx.db.drizzle
      .insert(pluginRaffleItems)
      .values({
        tenantId: this.ctx.tenantId,
        guildId: input.guildId,
        channelId: input.channelId,
        title: input.title,
        prize: input.prize,
        drawAt: input.drawAt,
        status: 'open',
        createdBy: input.createdBy,
      })
      .$returningId()
    return result.id
  }

  async listRaffles(guildId: string, params?: { status?: string; page?: number; size?: number }) {
    const page = Math.max(1, params?.page ?? 1)
    const size = Math.min(100, Math.max(1, params?.size ?? 20))
    const offset = (page - 1) * size
    const conditions = [
      eq(pluginRaffleItems.tenantId, this.ctx.tenantId),
      eq(pluginRaffleItems.guildId, guildId),
    ]
    if (params?.status) conditions.push(eq(pluginRaffleItems.status, params.status))
    const whereExpr = and(...conditions)

    const [rows, [totalRow]] = await Promise.all([
      this.ctx.db.drizzle
        .select()
        .from(pluginRaffleItems)
        .where(whereExpr)
        .orderBy(desc(pluginRaffleItems.createdAt))
        .limit(size)
        .offset(offset),
      this.ctx.db.drizzle
        .select({ value: count() })
        .from(pluginRaffleItems)
        .where(whereExpr),
    ])

    return { rows, total: totalRow?.value ?? 0, page, size }
  }

  async joinRaffle(raffleId: number, guildId: string, userId: string) {
    const [raffle] = await this.ctx.db.drizzle
      .select()
      .from(pluginRaffleItems)
      .where(and(
        eq(pluginRaffleItems.tenantId, this.ctx.tenantId),
        eq(pluginRaffleItems.id, raffleId),
      ))
      .limit(1)

    if (!raffle || raffle.guildId !== guildId) return { success: false, message: '抽奖不存在' }
    if (raffle.status !== 'open') return { success: false, message: '抽奖已结束' }

    await this.ctx.db.drizzle
      .insert(pluginRaffleParticipants)
      .values({
        tenantId: this.ctx.tenantId,
        raffleId,
        guildId,
        userId,
      })
      .onDuplicateKeyUpdate({
        set: { joinedAt: new Date() },
      })

    return { success: true, message: '参与成功' }
  }

  async listParticipants(raffleId: number) {
    return this.ctx.db.drizzle
      .select()
      .from(pluginRaffleParticipants)
      .where(and(
        eq(pluginRaffleParticipants.tenantId, this.ctx.tenantId),
        eq(pluginRaffleParticipants.raffleId, raffleId),
      ))
      .orderBy(desc(pluginRaffleParticipants.joinedAt))
  }

  async drawWinner(raffleId: number) {
    const [raffle] = await this.ctx.db.drizzle
      .select()
      .from(pluginRaffleItems)
      .where(and(
        eq(pluginRaffleItems.tenantId, this.ctx.tenantId),
        eq(pluginRaffleItems.id, raffleId),
      ))
      .limit(1)

    if (!raffle) return { success: false, message: '抽奖不存在' }
    if (raffle.status === 'drawn') {
      return {
        success: true,
        winnerUserId: raffle.winnerUserId,
        prize: raffle.prize,
        title: raffle.title,
        message: '抽奖已开奖',
      }
    }
    if (raffle.status !== 'open') return { success: false, message: '抽奖已结束' }

    const participants = await this.listParticipants(raffleId)
    if (!participants.length) {
      const result = await this.ctx.db.drizzle
        .update(pluginRaffleItems)
        .set({ status: 'closed' })
        .where(and(
          eq(pluginRaffleItems.tenantId, this.ctx.tenantId),
          eq(pluginRaffleItems.id, raffleId),
          eq(pluginRaffleItems.status, 'open'),
        ))

      if (((result as any)?.affectedRows ?? 0) === 0) {
        const [latest] = await this.ctx.db.drizzle
          .select()
          .from(pluginRaffleItems)
          .where(and(
            eq(pluginRaffleItems.tenantId, this.ctx.tenantId),
            eq(pluginRaffleItems.id, raffleId),
          ))
          .limit(1)
        if (latest?.status === 'drawn') {
          return {
            success: true,
            winnerUserId: latest.winnerUserId,
            prize: latest.prize,
            title: latest.title,
            message: '抽奖已开奖',
          }
        }
      }

      return { success: false, message: '无人参与，已自动结束' }
    }

    const winner = participants[Math.floor(Math.random() * participants.length)]
    const result = await this.ctx.db.drizzle
      .update(pluginRaffleItems)
      .set({ status: 'drawn', winnerUserId: winner.userId })
      .where(and(
        eq(pluginRaffleItems.tenantId, this.ctx.tenantId),
        eq(pluginRaffleItems.id, raffleId),
        eq(pluginRaffleItems.status, 'open'),
      ))

    if (((result as any)?.affectedRows ?? 0) === 0) {
      const [latest] = await this.ctx.db.drizzle
        .select()
        .from(pluginRaffleItems)
        .where(and(
          eq(pluginRaffleItems.tenantId, this.ctx.tenantId),
          eq(pluginRaffleItems.id, raffleId),
        ))
        .limit(1)

      if (latest?.status === 'drawn') {
        return {
          success: true,
          winnerUserId: latest.winnerUserId,
          prize: latest.prize,
          title: latest.title,
          message: '抽奖已开奖',
        }
      }

      return { success: false, message: '抽奖状态已变更，请刷新后重试' }
    }

    return { success: true, winnerUserId: winner.userId, prize: raffle.prize, title: raffle.title }
  }

  async processAutoDraw() {
    const now = new Date()
    const rows = await this.ctx.db.drizzle
      .select()
      .from(pluginRaffleItems)
      .where(and(
        eq(pluginRaffleItems.tenantId, this.ctx.tenantId),
        eq(pluginRaffleItems.status, 'open'),
        lte(pluginRaffleItems.drawAt, now),
      ))

    for (const row of rows) {
      const result = await this.drawWinner(row.id)
      if ((result as any)?.winnerUserId) {
        await this.ctx.kookApi.sendChannelMessage(row.channelId, `抽奖「${row.title}」开奖：恭喜 <@${(result as any).winnerUserId}> 获得 ${row.prize}`)
      }
    }
  }
}
