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
}

export class CommandRouter {
  /** Map: command name or alias → registered command */
  private readonly lookup = new Map<string, RegisteredCommand>()

  /**
   * Collect command definitions from all loaded plugins and build lookup map.
   */
  collectCommands(
    plugins: Map<string, { plugin: IPlugin; ctx: PluginContext }>,
  ): void {
    this.lookup.clear()

    for (const [, { plugin, ctx }] of plugins) {
      const commands = plugin.getCommands()
      for (const def of commands) {
        const entry: RegisteredCommand = { definition: def, ctx }

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

    const registered = this.lookup.get(cmdName.toLowerCase())
    if (!registered) return false

    const args = parts.slice(1)

    // Permission check
    const permission = registered.definition.permission ?? 'everyone'
    if (permission === 'admin' || permission === 'owner') {
      const roles: number[] = (event as any).extra?.author?.roles ?? []
      // If no roles data available, deny non-'everyone' permissions
      if (roles.length === 0) {
        return false
      }
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
