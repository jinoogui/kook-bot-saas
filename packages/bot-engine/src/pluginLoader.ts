import type { IPlugin, PluginContext } from '@kook-saas/shared'

export class PluginLoader {
  /** All registered (available) plugins */
  private readonly registry = new Map<string, IPlugin>()
  /** Loaded (active) plugins with their contexts */
  private readonly loaded = new Map<string, { plugin: IPlugin; ctx: PluginContext }>()

  /**
   * Register a plugin as available (does not load it).
   */
  registerPlugin(plugin: IPlugin): void {
    if (this.registry.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`)
    }
    this.registry.set(plugin.id, plugin)
  }

  /**
   * Load a plugin by ID. Calls onLoad and stores the reference.
   * Validates that all dependencies are already loaded.
   */
  async loadPlugin(pluginId: string, ctx: PluginContext): Promise<void> {
    const plugin = this.registry.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" is not registered`)
    }
    if (this.loaded.has(pluginId)) {
      throw new Error(`Plugin "${pluginId}" is already loaded`)
    }

    // Validate dependencies are loaded
    for (const depId of plugin.dependencies) {
      if (!this.loaded.has(depId)) {
        throw new Error(
          `Plugin "${pluginId}" depends on "${depId}" which is not loaded. ` +
          `Load dependencies first or use resolveDependencies() for correct order.`,
        )
      }
    }

    await plugin.onLoad(ctx)
    this.loaded.set(pluginId, { plugin, ctx })
  }

  /**
   * Unload a plugin by ID. Calls onUnload and removes the reference.
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const entry = this.loaded.get(pluginId)
    if (!entry) {
      throw new Error(`Plugin "${pluginId}" is not loaded`)
    }
    await entry.plugin.onUnload()
    this.loaded.delete(pluginId)
  }

  /**
   * Returns a Map of all loaded plugins.
   */
  getLoadedPlugins(): Map<string, { plugin: IPlugin; ctx: PluginContext }> {
    return this.loaded
  }

  /**
   * Returns a single loaded plugin entry, or undefined.
   */
  getPlugin(id: string): { plugin: IPlugin; ctx: PluginContext } | undefined {
    return this.loaded.get(id)
  }

  /**
   * Topological sort of plugin IDs by dependencies.
   * Throws on circular dependency or missing dependency.
   */
  resolveDependencies(pluginIds: string[]): string[] {
    // Deduplicate plugin IDs
    const dedupedIds = [...new Set(pluginIds)]
    // Build adjacency: pluginId -> list of deps within pluginIds
    const idSet = new Set(dedupedIds)
    const adjMap = new Map<string, string[]>()

    for (const id of dedupedIds) {
      const plugin = this.registry.get(id)
      if (!plugin) {
        throw new Error(`Plugin "${id}" is not registered, cannot resolve dependencies`)
      }
      // Validate all dependencies are in the enabled set
      for (const dep of plugin.dependencies) {
        if (!idSet.has(dep)) {
          throw new Error(`Plugin "${id}" depends on "${dep}" which is not enabled`)
        }
      }
      const deps = plugin.dependencies.filter((d) => idSet.has(d))
      adjMap.set(id, deps)
    }

    // Kahn's algorithm for topological sort
    // inDegree of id = number of deps it has within the set.

    const inDeg = new Map<string, number>()
    for (const id of dedupedIds) {
      inDeg.set(id, adjMap.get(id)!.length)
    }

    const queue: string[] = []
    for (const id of dedupedIds) {
      if (inDeg.get(id) === 0) {
        queue.push(id)
      }
    }

    // Build reverse adjacency: dep -> list of nodes that depend on dep
    const reverseAdj = new Map<string, string[]>()
    for (const id of dedupedIds) {
      reverseAdj.set(id, [])
    }
    for (const [id, deps] of adjMap) {
      for (const dep of deps) {
        reverseAdj.get(dep)!.push(id)
      }
    }

    const sorted: string[] = []
    while (queue.length > 0) {
      const current = queue.shift()!
      sorted.push(current)
      for (const dependent of reverseAdj.get(current) ?? []) {
        const newDeg = inDeg.get(dependent)! - 1
        inDeg.set(dependent, newDeg)
        if (newDeg === 0) {
          queue.push(dependent)
        }
      }
    }

    if (sorted.length !== dedupedIds.length) {
      const remaining = dedupedIds.filter((id) => !sorted.includes(id))
      throw new Error(`Circular dependency detected among plugins: ${remaining.join(', ')}`)
    }

    return sorted
  }
}
