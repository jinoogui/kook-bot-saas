import { eq, and, lte } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { parseTimeString } from '@kook-saas/shared'
import { pluginReminders } from './schema.js'

export { parseTimeString }

export class ReminderService {
  private readonly db: any
  private readonly tenantId: string

  constructor(private ctx: PluginContext) {
    this.db = ctx.db.drizzle
    this.tenantId = ctx.tenantId
  }

  async addReminder(
    userId: string,
    guildId: string,
    channelId: string,
    content: string,
    remindAt: Date,
  ): Promise<number> {
    const [result] = await this.db.insert(pluginReminders).values({
      tenantId: this.tenantId,
      userId,
      guildId,
      channelId,
      content,
      remindAt,
    })
    return (result as any).insertId
  }

  async getUserReminders(userId: string, guildId: string) {
    return this.db
      .select()
      .from(pluginReminders)
      .where(
        and(
          eq(pluginReminders.tenantId, this.tenantId),
          eq(pluginReminders.userId, userId),
          eq(pluginReminders.guildId, guildId),
          eq(pluginReminders.sent, 0),
        ),
      )
      .orderBy(pluginReminders.remindAt)
  }

  async deleteReminder(id: number, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(pluginReminders)
      .where(
        and(
          eq(pluginReminders.id, id),
          eq(pluginReminders.tenantId, this.tenantId),
          eq(pluginReminders.userId, userId),
        ),
      )
    return (result as any).affectedRows > 0
  }

  /**
   * 检查并发送到期提醒（由定时器触发）
   */
  async checkAndSend(): Promise<void> {
    const now = new Date()
    const pending = await this.db
      .select()
      .from(pluginReminders)
      .where(
        and(
          eq(pluginReminders.tenantId, this.tenantId),
          eq(pluginReminders.sent, 0),
          lte(pluginReminders.remindAt, now),
        ),
      )
      .limit(50)

    for (const r of pending) {
      try {
        const card = {
          type: 'card',
          theme: 'warning',
          size: 'lg',
          modules: [
            { type: 'header', text: { type: 'plain-text', content: '提醒到了！' } },
            {
              type: 'section',
              text: {
                type: 'kmarkdown',
                content: `(met)${r.userId}(met) ${r.content}`,
              },
            },
          ],
        }
        await this.ctx.kookApi.sendCardMessage(r.channelId, [card])
        await this.db
          .update(pluginReminders)
          .set({ sent: 1 })
          .where(eq(pluginReminders.id, r.id))
        this.ctx.logger.info(`已发送提醒 id=${r.id} -> uid=${r.userId}`)
      } catch (err) {
        this.ctx.logger.error(`发送提醒 ${r.id} 失败:`, err)
      }
      // 避免频繁发送
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }
}
