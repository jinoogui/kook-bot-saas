import { eq, and } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { pluginRoleClaimConfigs } from './schema.js'

export class RoleClaimService {
  constructor(private ctx: PluginContext) {}

  async getConfigs(guildId: string) {
    return this.ctx.db.drizzle
      .select()
      .from(pluginRoleClaimConfigs)
      .where(and(
        eq(pluginRoleClaimConfigs.tenantId, this.ctx.tenantId),
        eq(pluginRoleClaimConfigs.guildId, guildId),
        eq(pluginRoleClaimConfigs.enabled, 1),
      ))
  }

  async toggleRole(
    userId: string,
    guildId: string,
    roleId: string,
  ): Promise<{ success: boolean; action: 'granted' | 'revoked' | 'error'; message: string }> {
    try {
      try {
        await this.ctx.kookApi.addRole(guildId, userId, roleId)
        return { success: true, action: 'granted', message: '身份组已授予' }
      } catch (err: any) {
        if (err?.response?.data?.code === 40009) {
          await this.ctx.kookApi.removeRole(guildId, userId, roleId)
          return { success: true, action: 'revoked', message: '身份组已移除' }
        }
        throw err
      }
    } catch (err) {
      this.ctx.logger.error('toggleRole 失败:', err)
      return { success: false, action: 'error', message: '操作失败，请稍后重试' }
    }
  }

  private async isRoleAllowed(guildId: string, roleId: string, channelId?: string, msgId?: string): Promise<boolean> {
    const rows = await this.ctx.db.drizzle
      .select({ channelId: pluginRoleClaimConfigs.channelId, messageId: pluginRoleClaimConfigs.messageId })
      .from(pluginRoleClaimConfigs)
      .where(and(
        eq(pluginRoleClaimConfigs.tenantId, this.ctx.tenantId),
        eq(pluginRoleClaimConfigs.guildId, guildId),
        eq(pluginRoleClaimConfigs.roleId, roleId),
        eq(pluginRoleClaimConfigs.enabled, 1),
      ))

    if (!rows.length) return false
    if (!channelId) return true

    return rows.some((row: any) => {
      if (row.channelId !== channelId) return false
      if (!row.messageId) return true
      return !!msgId && row.messageId === msgId
    })
  }

  async onButtonClick(
    userId: string,
    guildId: string,
    value: string,
    channelId: string,
    msgId: string,
  ): Promise<void> {
    void channelId
    void msgId
    if (!value.startsWith('role_claim:')) return
    const roleId = value.replace('role_claim:', '')
    if (!roleId) return

    const allowed = await this.isRoleAllowed(guildId, roleId, channelId, msgId)
    if (!allowed) {
      await this.ctx.kookApi.sendDirectMessage(userId, '❌ 该身份组按钮已失效或不允许领取')
      return
    }

    const result = await this.toggleRole(userId, guildId, roleId)
    try {
      const icon = result.action === 'granted' ? '✅' : result.action === 'revoked' ? '🔄' : '❌'
      await this.ctx.kookApi.sendDirectMessage(userId, `${icon} ${result.message}`)
    } catch {
      // ignore DM failure
    }
  }

  async createPanel(
    guildId: string,
    channelId: string,
    title: string,
    roles: Array<{ roleId: string; label: string; emoji?: string }>,
  ): Promise<void> {
    const elements = roles.map(r => ({
      type: 'button',
      text: { type: 'plain-text', content: `${r.emoji ?? ''} ${r.label}`.trim() },
      value: `role_claim:${r.roleId}`,
      click: 'return-val',
    }))

    const card = {
      type: 'card', theme: 'secondary', size: 'lg',
      modules: [
        { type: 'header', text: { type: 'plain-text', content: title } },
        { type: 'divider' },
        { type: 'section', text: { type: 'kmarkdown', content: '点击按钮领取或取消对应身份组' } },
        { type: 'action-group', elements },
      ],
    }
    await this.ctx.kookApi.sendCardMessage(channelId, [card])
  }
}
