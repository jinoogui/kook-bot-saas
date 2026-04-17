import { and, count, desc, eq, lte } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { pluginPollsItems, pluginPollsVotes } from './schema.js'

function parseOptions(raw: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item).trim()).filter(Boolean)
  } catch {
    return []
  }
}

function toOptionKey(index: number): string {
  return `opt${index + 1}`
}

export class PollsService {
  constructor(private ctx: PluginContext) {}

  async createPoll(input: {
    guildId: string
    channelId: string
    title: string
    options: string[]
    allowMulti?: boolean
    endsAt?: Date | null
    createdBy: string
  }) {
    const options = input.options.map((item) => item.trim()).filter(Boolean)
    if (options.length < 2) {
      throw new Error('至少需要 2 个选项')
    }

    const [result] = await this.ctx.db.drizzle
      .insert(pluginPollsItems)
      .values({
        tenantId: this.ctx.tenantId,
        guildId: input.guildId,
        channelId: input.channelId,
        title: input.title.trim(),
        optionsJson: JSON.stringify(options),
        allowMulti: input.allowMulti ? 1 : 0,
        status: 'open',
        endsAt: input.endsAt ?? null,
        createdBy: input.createdBy,
      })
      .$returningId()

    return result.id
  }

  async listPolls(guildId: string, params?: { status?: string; page?: number; size?: number }) {
    const page = Math.max(1, params?.page ?? 1)
    const size = Math.min(100, Math.max(1, params?.size ?? 20))
    const offset = (page - 1) * size

    const conditions = [
      eq(pluginPollsItems.tenantId, this.ctx.tenantId),
      eq(pluginPollsItems.guildId, guildId),
    ]
    if (params?.status) {
      conditions.push(eq(pluginPollsItems.status, params.status))
    }
    const whereExpr = and(...conditions)

    const [rows, [totalRow]] = await Promise.all([
      this.ctx.db.drizzle
        .select()
        .from(pluginPollsItems)
        .where(whereExpr)
        .orderBy(desc(pluginPollsItems.createdAt))
        .limit(size)
        .offset(offset),
      this.ctx.db.drizzle
        .select({ value: count() })
        .from(pluginPollsItems)
        .where(whereExpr),
    ])

    const mapped = rows.map((row: any) => ({
      ...row,
      options: parseOptions(row.optionsJson || '[]'),
      allowMulti: row.allowMulti === 1,
    }))

    return { rows: mapped, total: totalRow?.value ?? 0, page, size }
  }

  async getPoll(pollId: number) {
    const [row] = await this.ctx.db.drizzle
      .select()
      .from(pluginPollsItems)
      .where(and(
        eq(pluginPollsItems.tenantId, this.ctx.tenantId),
        eq(pluginPollsItems.id, pollId),
      ))
      .limit(1)

    if (!row) return null
    return {
      ...row,
      options: parseOptions((row as any).optionsJson || '[]'),
      allowMulti: (row as any).allowMulti === 1,
    }
  }

  async vote(pollId: number, guildId: string, userId: string, optionKeys: string[]) {
    const poll = await this.getPoll(pollId)
    if (!poll || poll.guildId !== guildId) {
      return { success: false, message: '投票不存在' }
    }
    if (poll.status !== 'open') {
      return { success: false, message: '投票已结束' }
    }

    const options = (poll as any).options as string[]
    const validKeys = new Set(options.map((_, idx) => toOptionKey(idx)))
    const normalized = Array.from(new Set(optionKeys.map((key) => String(key).trim()).filter((key) => validKeys.has(key))))

    if (!normalized.length) {
      return { success: false, message: '无效选项' }
    }

    const allowMulti = (poll as any).allowMulti === true
    if (!allowMulti && normalized.length > 1) {
      return { success: false, message: '该投票只允许单选' }
    }

    await this.ctx.db.drizzle
      .delete(pluginPollsVotes)
      .where(and(
        eq(pluginPollsVotes.tenantId, this.ctx.tenantId),
        eq(pluginPollsVotes.pollId, pollId),
        eq(pluginPollsVotes.userId, userId),
      ))

    for (const optionKey of normalized) {
      // eslint-disable-next-line no-await-in-loop
      await this.ctx.db.drizzle
        .insert(pluginPollsVotes)
        .values({
          tenantId: this.ctx.tenantId,
          guildId,
          pollId,
          userId,
          optionKey,
        })
        .onDuplicateKeyUpdate({
          set: { optionKey },
        })
    }

    return { success: true, message: '投票成功' }
  }

  async getResults(pollId: number) {
    const poll = await this.getPoll(pollId)
    if (!poll) return null

    const votes = await this.ctx.db.drizzle
      .select()
      .from(pluginPollsVotes)
      .where(and(
        eq(pluginPollsVotes.tenantId, this.ctx.tenantId),
        eq(pluginPollsVotes.pollId, pollId),
      ))

    const options = (poll as any).options as string[]
    const tally = new Map<string, number>()
    const voters = new Map<string, string[]>()

    for (const vote of votes as any[]) {
      tally.set(vote.optionKey, (tally.get(vote.optionKey) ?? 0) + 1)
      const list = voters.get(vote.userId) ?? []
      list.push(vote.optionKey)
      voters.set(vote.userId, list)
    }

    const summary = options.map((label, index) => {
      const key = toOptionKey(index)
      return {
        key,
        label,
        count: tally.get(key) ?? 0,
      }
    })

    return {
      poll,
      options: summary,
      totalVotes: votes.length,
      voterCount: voters.size,
    }
  }

  async closePoll(pollId: number) {
    const result = await this.ctx.db.drizzle
      .update(pluginPollsItems)
      .set({ status: 'closed' })
      .where(and(
        eq(pluginPollsItems.tenantId, this.ctx.tenantId),
        eq(pluginPollsItems.id, pollId),
      ))

    return (result as any)?.affectedRows ?? 0
  }

  async autoCloseExpired() {
    const now = new Date()
    const result = await this.ctx.db.drizzle
      .update(pluginPollsItems)
      .set({ status: 'closed' })
      .where(and(
        eq(pluginPollsItems.tenantId, this.ctx.tenantId),
        eq(pluginPollsItems.status, 'open'),
        lte(pluginPollsItems.endsAt, now),
      ))

    return (result as any)?.affectedRows ?? 0
  }
}
