import type {
  KookEvent,
  KookEventType,
  EventHandlerDefinition,
  PluginContext,
  IPlugin,
} from '@kook-saas/shared'

interface RegisteredHandler {
  definition: EventHandlerDefinition
  ctx: PluginContext
}

/**
 * Map Kook numeric message type to our event type string.
 * type 1 = text message, type 9 = kmarkdown message -> 'message'
 * type 255 = system event -> derived from extra.type
 */
function resolveEventTypes(event: KookEvent): KookEventType[] {
  if (event.type === 1 || event.type === 9 || event.type === 10) {
    return ['message']
  }
  if (event.type === 255) {
    const subType = event.extra?.type
    if (typeof subType === 'string') {
      return [subType as KookEventType]
    }
  }
  return []
}

export class Dispatcher {
  private handlers: RegisteredHandler[] = []

  /**
   * Collect event handler definitions from all loaded plugins.
   */
  collectHandlers(
    plugins: Map<string, { plugin: IPlugin; ctx: PluginContext }>,
  ): void {
    this.handlers = []

    for (const [, { plugin, ctx }] of plugins) {
      const definitions = plugin.getEventHandlers()
      for (const def of definitions) {
        this.handlers.push({ definition: def, ctx })
      }
    }

    // Sort by priority ascending (lower number = higher priority)
    this.handlers.sort((a, b) => a.definition.priority - b.definition.priority)
  }

  /**
   * Dispatch a Kook event to matching handlers.
   * Returns true if any handler short-circuited (returned true).
   */
  async dispatch(event: KookEvent): Promise<boolean> {
    const eventTypes = resolveEventTypes(event)
    if (eventTypes.length === 0) return false

    for (const { definition, ctx } of this.handlers) {
      const listenTypes = Array.isArray(definition.eventType)
        ? definition.eventType
        : [definition.eventType]

      const matches = listenTypes.some((t) => eventTypes.includes(t))
      if (!matches) continue

      try {
        const handled = await definition.handler(event, ctx)
        if (handled) return true
      } catch (err) {
        ctx.logger.error(`Event handler error: ${err}`)
      }
    }

    return false
  }
}
