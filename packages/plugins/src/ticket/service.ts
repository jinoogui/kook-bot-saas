import { and, count, desc, eq, lt } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { pluginTicketLogs, pluginTicketTickets } from './schema.js'

export class TicketService {
  constructor(private ctx: PluginContext) {}

  private static readonly VALID_STATUS = new Set(['open', 'processing', 'closed'])

  private toSafeStatus(status?: string): 'open' | 'processing' | 'closed' | null {
    if (!status) return null
    const normalized = String(status).trim().toLowerCase()
    return TicketService.VALID_STATUS.has(normalized) ? normalized as 'open' | 'processing' | 'closed' : null
  }

  private toSafePriority(priority?: string): 'low' | 'normal' | 'high' {
    const normalized = String(priority || '').trim().toLowerCase()
    if (normalized === 'low' || normalized === 'high') return normalized
    return 'normal'
  }

  private toSafeTitle(title: string): string {
    return String(title || '').trim().slice(0, 200)
  }

  private toSafeContent(content?: string): string | null {
    const value = String(content || '').trim()
    if (!value) return null
    return value.slice(0, 4000)
  }

  private async getSupportChannel(): Promise<string | null> {
    const config = await this.ctx.getConfig()
    const supportChannel = String(config?.support_channel_id || '').trim()
    return supportChannel || null
  }

  private async getDefaultPriority(): Promise<'low' | 'normal' | 'high'> {
    const config = await this.ctx.getConfig()
    return this.toSafePriority(String(config?.default_priority || 'normal'))
  }

  async createTicket(input: {
    guildId: string
    channelId: string
    creatorUserId: string
    title: string
    content?: string
    priority?: 'low' | 'normal' | 'high'
  }) {
    const title = this.toSafeTitle(input.title)
    if (!title) {
      throw new Error('工单标题不能为空')
    }

    const supportChannel = await this.getSupportChannel()
    const channelId = supportChannel || input.channelId
    if (!channelId) {
      throw new Error('缺少工单频道，请先配置 support_channel_id 或传入 channelId')
    }

    const defaultPriority = await this.getDefaultPriority()
    const priority = this.toSafePriority(input.priority || defaultPriority)

    const [result] = await this.ctx.db.drizzle
      .insert(pluginTicketTickets)
      .values({
        tenantId: this.ctx.tenantId,
        guildId: input.guildId,
        channelId,
        creatorUserId: input.creatorUserId,
        title,
        content: this.toSafeContent(input.content),
        priority,
        status: 'open',
      })
      .$returningId()

    await this.addLog(result.id, 'create', input.creatorUserId, this.toSafeContent(input.content) || '')
    return result.id
  }

  async listTickets(guildId: string, params?: { status?: string; page?: number; size?: number }) {
    const page = Math.max(1, params?.page ?? 1)
    const size = Math.min(100, Math.max(1, params?.size ?? 20))
    const offset = (page - 1) * size
    const conditions = [
      eq(pluginTicketTickets.tenantId, this.ctx.tenantId),
      eq(pluginTicketTickets.guildId, guildId),
    ]

    const safeStatus = this.toSafeStatus(params?.status)
    if (params?.status && !safeStatus) {
      throw new Error('无效状态，仅支持 open/processing/closed')
    }
    if (safeStatus) {
      conditions.push(eq(pluginTicketTickets.status, safeStatus))
    }

    const whereExpr = and(...conditions)

    const [rows, [totalRow]] = await Promise.all([
      this.ctx.db.drizzle
        .select()
        .from(pluginTicketTickets)
        .where(whereExpr)
        .orderBy(desc(pluginTicketTickets.createdAt))
        .limit(size)
        .offset(offset),
      this.ctx.db.drizzle
        .select({ value: count() })
        .from(pluginTicketTickets)
        .where(whereExpr),
    ])

    return { rows, total: totalRow?.value ?? 0, page, size }
  }

  async getTicket(ticketId: number) {
    const [row] = await this.ctx.db.drizzle
      .select()
      .from(pluginTicketTickets)
      .where(and(
        eq(pluginTicketTickets.tenantId, this.ctx.tenantId),
        eq(pluginTicketTickets.id, ticketId),
      ))
      .limit(1)
    return row ?? null
  }

  async assignTicket(ticketId: number, assigneeUserId: string, operatorUserId: string) {
    const [ticket] = await this.ctx.db.drizzle
      .select({ status: pluginTicketTickets.status })
      .from(pluginTicketTickets)
      .where(and(
        eq(pluginTicketTickets.tenantId, this.ctx.tenantId),
        eq(pluginTicketTickets.id, ticketId),
      ))
      .limit(1)

    if (!ticket) {
      return { affected: 0, message: '工单不存在' }
    }

    if (ticket.status === 'closed') {
      return { affected: 0, message: '工单已关闭，无法指派' }
    }

    const result = await this.ctx.db.drizzle
      .update(pluginTicketTickets)
      .set({ assigneeUserId, status: 'processing' })
      .where(and(
        eq(pluginTicketTickets.tenantId, this.ctx.tenantId),
        eq(pluginTicketTickets.id, ticketId),
        eq(pluginTicketTickets.status, ticket.status),
      ))

    const affected = (result as any)?.affectedRows ?? 0
    if (affected > 0) {
      await this.addLog(ticketId, 'assign', operatorUserId, assigneeUserId)
      return { affected, message: '工单已指派' }
    }

    return { affected: 0, message: '工单状态已变化，请刷新后重试' }
  }

  async closeTicket(ticketId: number, operatorUserId: string, reason?: string) {
    const [ticket] = await this.ctx.db.drizzle
      .select({ status: pluginTicketTickets.status })
      .from(pluginTicketTickets)
      .where(and(
        eq(pluginTicketTickets.tenantId, this.ctx.tenantId),
        eq(pluginTicketTickets.id, ticketId),
      ))
      .limit(1)

    if (!ticket) {
      return { affected: 0, message: '工单不存在', alreadyClosed: false }
    }

    if (ticket.status === 'closed') {
      return { affected: 1, message: '工单已关闭', alreadyClosed: true }
    }

    const result = await this.ctx.db.drizzle
      .update(pluginTicketTickets)
      .set({ status: 'closed', closedAt: new Date() })
      .where(and(
        eq(pluginTicketTickets.tenantId, this.ctx.tenantId),
        eq(pluginTicketTickets.id, ticketId),
        eq(pluginTicketTickets.status, ticket.status),
      ))

    const affectedRows = (result as any)?.affectedRows ?? 0
    if (affectedRows > 0) {
      await this.addLog(ticketId, 'close', operatorUserId, String(reason || '').slice(0, 500))
      return { affected: affectedRows, message: '工单已关闭', alreadyClosed: false }
    }

    return { affected: 0, message: '工单状态已变化，请刷新后重试', alreadyClosed: false }
  }

  async autoCloseExpired() {
    const config = await this.ctx.getConfig()
    const autoCloseHours = Math.max(0, Number(config.auto_close_hours ?? 72))
    if (autoCloseHours <= 0) return 0

    const deadline = new Date(Date.now() - autoCloseHours * 3600 * 1000)
    const result = await this.ctx.db.drizzle
      .update(pluginTicketTickets)
      .set({ status: 'closed', closedAt: new Date() })
      .where(and(
        eq(pluginTicketTickets.tenantId, this.ctx.tenantId),
        eq(pluginTicketTickets.status, 'open'),
        lt(pluginTicketTickets.createdAt, deadline),
      ))

    return (result as any)?.affectedRows ?? 0
  }

  async getLogs(ticketId: number) {
    return this.ctx.db.drizzle
      .select()
      .from(pluginTicketLogs)
      .where(and(
        eq(pluginTicketLogs.tenantId, this.ctx.tenantId),
        eq(pluginTicketLogs.ticketId, ticketId),
      ))
      .orderBy(desc(pluginTicketLogs.createdAt))
  }

  private async addLog(ticketId: number, action: string, operatorUserId: string, detail: string) {
    await this.ctx.db.drizzle
      .insert(pluginTicketLogs)
      .values({
        tenantId: this.ctx.tenantId,
        ticketId,
        action,
        operatorUserId,
        detail: String(detail || '').slice(0, 4000),
      })
  }
}
