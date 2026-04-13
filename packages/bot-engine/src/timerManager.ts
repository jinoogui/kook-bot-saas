import type { TimerDefinition, PluginContext } from '@kook-saas/shared'

export class TimerManager {
  /** pluginId → list of interval handles */
  private readonly timers = new Map<string, NodeJS.Timeout[]>()

  /**
   * Register and start timers for a plugin.
   */
  registerTimers(
    pluginId: string,
    timers: TimerDefinition[],
    ctx: PluginContext,
  ): void {
    const handles: NodeJS.Timeout[] = []

    for (const timer of timers) {
      // If immediate, run once right away
      if (timer.immediate) {
        timer.handler(ctx).catch((err) => {
          ctx.logger.error(`Timer "${timer.name}" immediate execution error: ${err}`)
        })
      }

      const handle = setInterval(() => {
        timer.handler(ctx).catch((err) => {
          ctx.logger.error(`Timer "${timer.name}" error: ${err}`)
        })
      }, timer.intervalMs)

      handles.push(handle)
    }

    // Append to any existing timers for this plugin
    const existing = this.timers.get(pluginId) ?? []
    this.timers.set(pluginId, [...existing, ...handles])
  }

  /**
   * Unregister and clear all timers for a given plugin.
   */
  unregisterTimers(pluginId: string): void {
    const handles = this.timers.get(pluginId)
    if (!handles) return
    for (const h of handles) {
      clearInterval(h)
    }
    this.timers.delete(pluginId)
  }

  /**
   * Stop all timers across all plugins.
   */
  stopAll(): void {
    for (const [, handles] of this.timers) {
      for (const h of handles) {
        clearInterval(h)
      }
    }
    this.timers.clear()
  }
}
