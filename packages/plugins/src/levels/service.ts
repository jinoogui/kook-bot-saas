import { eq, and, sql } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { pluginLevelsUserActivity, pluginLevelsConfigs } from './schema.js'

const DEFAULT_XP_PER_MESSAGE = 10
const DEFAULT_XP_COOLDOWN    = 60 // 秒

export class LevelService {
  // 冷却追踪：`${userId}:${guildId}` -> 上次获得经验时间戳
  private static xpCooldown = new Map<string, number>()

  constructor(private ctx: PluginContext) {}

  private async getConfig(guildId: string) {
    const [row] = await this.ctx.db.drizzle
      .select()
      .from(pluginLevelsConfigs)
      .where(
        and(
          eq(pluginLevelsConfigs.tenantId, this.ctx.tenantId),
          eq(pluginLevelsConfigs.guildId, guildId),
        ),
      )
      .limit(1)
    return {
      enabled:        row?.enabled === 1,
      xpPerMessage:   row?.xpPerMessage  ?? DEFAULT_XP_PER_MESSAGE,
      xpCooldown:     row?.xpCooldown    ?? DEFAULT_XP_COOLDOWN,
      levelUpChannel: row?.levelUpChannel ?? null,
    }
  }

  /** 经验值计算公式：升到 level 级需要的总 XP */
  private xpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5))
  }

  /** 根据总 XP 计算当前等级 */
  private calcLevel(totalXp: number): number {
    let level = 1
    while (this.xpForLevel(level + 1) <= totalXp) level++
    return level
  }

  /**
   * 用户发消息时调用，处理经验值增加和升级通知
   */
  async onMessage(
    userId: string,
    guildId: string,
    channelId: string,
    username: string,
  ): Promise<void> {
    const cfg = await this.getConfig(guildId)
    if (!cfg.enabled) return

    // 冷却检查
    const cooldownKey = `${userId}:${guildId}`
    const lastXp = LevelService.xpCooldown.get(cooldownKey) ?? 0
    const now    = Date.now()
    if (now - lastXp < cfg.xpCooldown * 1000) return
    LevelService.xpCooldown.set(cooldownKey, now)

    // 获取当前经验
    const [row] = await this.ctx.db.drizzle
      .select()
      .from(pluginLevelsUserActivity)
      .where(
        and(
          eq(pluginLevelsUserActivity.tenantId, this.ctx.tenantId),
          eq(pluginLevelsUserActivity.userId, userId),
          eq(pluginLevelsUserActivity.guildId, guildId),
        ),
      )
      .limit(1)

    const prevXp    = row?.totalXp ?? 0
    const prevLevel = this.calcLevel(prevXp)
    const newXp     = prevXp + cfg.xpPerMessage
    const newLevel  = this.calcLevel(newXp)

    // 更新经验值和消息计数
    await this.ctx.db.drizzle
      .insert(pluginLevelsUserActivity)
      .values({
        tenantId: this.ctx.tenantId,
        userId,
        guildId,
        messageCount: 1,
        totalXp: newXp,
        lastActiveAt: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          messageCount: sql`message_count + 1`,
          totalXp: sql`total_xp + ${cfg.xpPerMessage}`,
          lastActiveAt: new Date(),
        },
      })

    // 升级通知
    if (newLevel > prevLevel) {
      const notifyChannelId = cfg.levelUpChannel ?? channelId
      const card = {
        type: 'card', theme: 'success', size: 'lg',
        modules: [
          { type: 'header', text: { type: 'plain-text', content: '🎉 升级了！' } },
          {
            type: 'section',
            text: {
              type: 'kmarkdown',
              content: `**${username}** 升到了 **Lv.${newLevel}**！\n当前经验：${newXp} XP`,
            },
          },
        ],
      }
      try {
        await this.ctx.kookApi.sendCardMessage(notifyChannelId, [card])
      } catch (err) {
        this.ctx.logger.error('发送升级通知失败:', err)
      }
    }
  }

  async getUserLevel(userId: string, guildId: string) {
    const [row] = await this.ctx.db.drizzle
      .select()
      .from(pluginLevelsUserActivity)
      .where(
        and(
          eq(pluginLevelsUserActivity.tenantId, this.ctx.tenantId),
          eq(pluginLevelsUserActivity.userId, userId),
          eq(pluginLevelsUserActivity.guildId, guildId),
        ),
      )
      .limit(1)
    const totalXp = row?.totalXp ?? 0
    const level   = this.calcLevel(totalXp)
    const nextXp  = this.xpForLevel(level + 1)
    return {
      level,
      totalXp,
      messageCount: row?.messageCount ?? 0,
      nextLevelXp:  nextXp,
      progress:     totalXp / nextXp,
    }
  }
}
