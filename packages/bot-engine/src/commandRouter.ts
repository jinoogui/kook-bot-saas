import type {
  KookMessageEvent,
  CommandDefinition,
  PluginContext,
  IPlugin,
} from '@kook-saas/shared'

const COMMAND_PREFIX = '/'

interface RegisteredCommand {
  definition: CommandDefinition
  ctx: PluginContext
  pluginId: string
  pluginName: string
}

interface HelpGroup {
  pluginId: string
  pluginName: string
  commands: CommandDefinition[]
}

export class CommandRouter {
  /** Map: command name or alias → registered command */
  private readonly lookup = new Map<string, RegisteredCommand>()
  private readonly helpGroups = new Map<string, HelpGroup>()
  private helpCtx: PluginContext | null = null

  private async hasAdminPermission(event: KookMessageEvent, ctx: PluginContext): Promise<boolean> {
    const guildId = event.extra?.guild_id
    const userId = event.author_id
    if (!guildId || !userId) {
      ctx.logger.warn(`command permission denied: missing guild/user context guild=${guildId || '-'} user=${userId || '-'}`)
      return false
    }

    try {
      const member = await ctx.kookApi.getGuildMember(guildId, userId)
      const roleIds = ((member?.roles || event.extra?.author?.roles || []) as Array<number | string>)
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)

      // 历史兼容：0 视作超级权限
      if (roleIds.includes(0)) return true

      const guild = await ctx.kookApi.getGuild(guildId)
      const guildRoles = Array.isArray(guild?.roles) ? guild.roles : []
      const adminRoleIds = new Set<number>()

      for (const role of guildRoles) {
        const roleId = Number(role?.role_id ?? role?.id)
        if (!Number.isFinite(roleId)) continue

        const permissions = Number(role?.permissions ?? 0)
        const isAdminRole = permissions > 0
          || role?.name === '管理员'
          || role?.name === 'admin'
          || role?.is_admin === 1

        if (isAdminRole) adminRoleIds.add(roleId)
      }

      const allowed = roleIds.some((roleId) => adminRoleIds.has(roleId))
      if (!allowed) {
        ctx.logger.warn(`command permission denied: requires admin guild=${guildId} user=${userId}`)
      }
      return allowed
    } catch (err: any) {
      ctx.logger.warn(`command permission denied: admin lookup failed guild=${guildId} user=${userId} error=${err?.message || err}`)
      return false
    }
  }

  private async hasOwnerPermission(event: KookMessageEvent, ctx: PluginContext): Promise<boolean> {
    const guildId = event.extra?.guild_id
    const userId = event.author_id
    if (!guildId || !userId) {
      ctx.logger.warn(`command permission denied: missing guild/user context guild=${guildId || '-'} user=${userId || '-'} (owner)`)
      return false
    }

    try {
      const guild = await ctx.kookApi.getGuild(guildId)
      const ownerId = String(guild?.master_id || guild?.owner_id || guild?.user_id || '')
      const allowed = !!ownerId && ownerId === String(userId)
      if (!allowed) {
        ctx.logger.warn(`command permission denied: requires owner guild=${guildId} user=${userId}`)
      }
      return allowed
    } catch (err: any) {
      ctx.logger.warn(`command permission denied: owner lookup failed guild=${guildId} user=${userId} error=${err?.message || err}`)
      return false
    }
  }

  private permissionLabel(permission?: CommandDefinition['permission']): string {
    if (permission === 'admin') return ' [管理员]'
    if (permission === 'owner') return ' [服主]'
    return ''
  }

  private isHelpCommand(name: string): boolean {
    const lowered = name.toLowerCase()
    return lowered === 'help' || name === '帮助'
  }

  private async handleHelpCommand(event: KookMessageEvent, args: string[]): Promise<boolean> {
    const channelId = event.target_id
    if (!channelId || !this.helpCtx) return false

    const keyword = String(args[0] || '').trim().toLowerCase()
    let groups = Array.from(this.helpGroups.values())

    if (keyword) {
      groups = groups.filter((group) => {
        if (group.pluginId.toLowerCase().includes(keyword) || group.pluginName.toLowerCase().includes(keyword)) {
          return true
        }

        return group.commands.some((def) => {
          if (def.name.toLowerCase().includes(keyword)) return true
          return def.aliases.some((alias) => alias.toLowerCase().includes(keyword))
        })
      })
    }

    groups.sort((a, b) => a.pluginId.localeCompare(b.pluginId))

    if (groups.length === 0) {
      await this.helpCtx.kookApi.sendChannelMessage(channelId, '未找到匹配命令。发送 /help 查看当前租户全部可用命令。')
      return true
    }

    const blocks = groups.map((group) => {
      const lines = group.commands.map((def) => {
        return `/${def.name} - ${def.description}${this.permissionLabel(def.permission)}`
      })
      return `【${group.pluginName} (${group.pluginId})】\n${lines.join('\n')}`
    })

    const header = keyword
      ? `当前租户命令（按已订阅插件筛选: ${keyword}）`
      : '当前租户命令（按已订阅插件）'

    const message = `${header}\n\n${blocks.join('\n\n')}\n\n可用 /help <插件ID|命令名> 做筛选`
    await this.helpCtx.kookApi.sendChannelMessage(channelId, message)
    return true
  }

  /**
   * Collect command definitions from all loaded plugins and build lookup map.
   */
  collectCommands(
    plugins: Map<string, { plugin: IPlugin; ctx: PluginContext }>,
  ): void {
    this.lookup.clear()
    this.helpGroups.clear()
    this.helpCtx = null

    for (const [, { plugin, ctx }] of plugins) {
      if (!this.helpCtx) this.helpCtx = ctx

      const commands = plugin.getCommands()
      if (commands.length > 0) {
        this.helpGroups.set(plugin.id, {
          pluginId: plugin.id,
          pluginName: plugin.name,
          commands,
        })
      }

      for (const def of commands) {
        const entry: RegisteredCommand = {
          definition: def,
          ctx,
          pluginId: plugin.id,
          pluginName: plugin.name,
        }

        // Warn on command name collision
        if (this.lookup.has(def.name.toLowerCase())) {
          console.warn(`[CommandRouter] Command name collision: "${def.name}" is being overwritten`)
        }
        // Register by primary name (normalized to lowercase)
        this.lookup.set(def.name.toLowerCase(), entry)

        // Register by aliases (normalized to lowercase)
        for (const alias of def.aliases) {
          if (this.lookup.has(alias.toLowerCase())) {
            console.warn(`[CommandRouter] Command alias collision: "${alias}" is being overwritten`)
          }
          this.lookup.set(alias.toLowerCase(), entry)
        }
      }
    }
  }

  /**
   * Try to handle a message event as a command.
   * Returns true if a command was matched and executed.
   */
  async handleCommand(event: KookMessageEvent): Promise<boolean> {
    const content = event.content?.trim()
    if (!content) return false

    // Strip KMarkdown mention syntax to prevent injection
    const cleanContent = content.replace(/\(met\).*?\(met\)/g, '').trim()
    if (!cleanContent) return false

    // Support both "/command" and "command" (without prefix)
    const hasPrefix = cleanContent.startsWith(COMMAND_PREFIX)
    const withoutPrefix = hasPrefix ? cleanContent.slice(COMMAND_PREFIX.length) : cleanContent
    const parts = withoutPrefix.split(/\s+/)
    const cmdName = parts[0]
    if (!cmdName) return false

    const args = parts.slice(1)

    if (this.isHelpCommand(cmdName)) {
      return this.handleHelpCommand(event, args)
    }

    const registered = this.lookup.get(cmdName.toLowerCase())
    if (!registered) return false

    // Permission check
    const permission = registered.definition.permission ?? 'everyone'
    if (permission === 'admin') {
      const allowed = await this.hasAdminPermission(event, registered.ctx)
      if (!allowed) return false
    }

    if (permission === 'owner') {
      const allowed = await this.hasOwnerPermission(event, registered.ctx)
      if (!allowed) return false
    }

    try {
      await registered.definition.handler(event, args, registered.ctx)
    } catch (err) {
      registered.ctx.logger.error(`Command "${cmdName}" error: ${err}`)
      // Re-throw so engine can log via IPC
      throw err
    }

    return true
  }
}
