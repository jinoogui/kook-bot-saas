import { eq } from 'drizzle-orm'
import type { PlatformDB } from '../db/index.js'
import { pluginCatalog } from '../db/schema/index.js'
import type { PluginMetadata } from '@kook-saas/shared'

export class PluginCatalogService {
  constructor(private db: PlatformDB) {}

  /** 获取所有可用插件 */
  async getAll() {
    return this.db
      .select()
      .from(pluginCatalog)
      .where(eq(pluginCatalog.enabled, 1))
  }

  /** 获取单个插件详情 */
  async getById(pluginId: string) {
    const [plugin] = await this.db
      .select()
      .from(pluginCatalog)
      .where(eq(pluginCatalog.id, pluginId))
      .limit(1)
    return plugin ?? null
  }

  /** 按分类筛选 */
  async getByCategory(category: string) {
    return this.db
      .select()
      .from(pluginCatalog)
      .where(and(
        eq(pluginCatalog.category, category),
        eq(pluginCatalog.enabled, 1),
      ))
  }

  /** 初始化/更新插件目录（从代码中的插件元数据同步） */
  async syncFromMetadata(plugins: PluginMetadata[]) {
    for (const plugin of plugins) {
      await this.db
        .insert(pluginCatalog)
        .values({
          id: plugin.id,
          name: plugin.name,
          description: plugin.description,
          category: plugin.category,
          tier: plugin.tier,
          priceMonthly: plugin.priceMonthly ?? 0,
          priceYearly: plugin.priceYearly ?? 0,
          dependencies: JSON.stringify(plugin.dependencies),
          version: plugin.version,
        })
        .onDuplicateKeyUpdate({
          set: {
            name: plugin.name,
            description: plugin.description,
            category: plugin.category,
            tier: plugin.tier,
            priceMonthly: plugin.priceMonthly ?? 0,
            priceYearly: plugin.priceYearly ?? 0,
            dependencies: JSON.stringify(plugin.dependencies),
            version: plugin.version,
          },
        })
    }
  }
}

// 需要从 drizzle-orm 导入 and
import { and } from 'drizzle-orm'
