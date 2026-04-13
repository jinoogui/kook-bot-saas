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

        // Register by primary name
        this.lookup.set(def.name, entry)

        // Register by aliases
        for (const alias of def.aliases) {
          this.lookup.set(alias, entry)
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
    if (!content || !content.startsWith(COMMAND_PREFIX)) return false

    // Parse: "/command arg1 arg2 ..."
    const withoutPrefix = content.slice(COMMAND_PREFIX.length)
    const parts = withoutPrefix.split(/\s+/)
    const cmdName = parts[0]
    if (!cmdName) return false

    const args = parts.slice(1)

    const registered = this.lookup.get(cmdName)
    if (!registered) return false

    try {
      await registered.definition.handler(event, args, registered.ctx)
    } catch (err) {
      registered.ctx.logger.error(`Command "${cmdName}" error: ${err}`)
    }

    return true
  }
}
