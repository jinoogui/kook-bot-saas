import { eq, and, sql } from 'drizzle-orm'
import type { PluginContext } from '@kook-saas/shared'
import { ACAutomaton, getChinaDate } from '@kook-saas/shared'
import { pluginFilterAds, pluginFilterViolationRecords } from './schema.js'

// ── 内置广告关键词 ────────────────────────────────
const BUILTIN_AD_KEYWORDS = [
  '加微信', '加QQ', '加群', '扫码', '二维码',
  '代练', '代打', '刷分', '刷金币', '刷钻石',
  '充值', '优惠', '折扣', '限时', '特价',
  '点击链接', '点击网址', '访问', '下载',
  '免费领取', '免费获得', '免费送',
  '推广', '广告', '营销', '代理',
  '赚钱', '兼职', '日赚', '月入',
  'vx', 'wx', 'qq群', 'q群',
  't.me', 'telegram', 'tg群',
]

// URL 正则
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/i

// 重复字符正则（4个以上相同字符）
const REPEAT_REGEX = /(.)(\1{4,})/

export interface FilterResult {
  isViolation: boolean
  type: 'ad_keyword' | 'forbidden_word' | 'url' | 'repeat_chars' | 'clean'
  matchedKeyword?: string
  reason?: string
}

export class FilterService {
  private guildAC = new Map<string, ACAutomaton>()
  private globalAC = new ACAutomaton()

  private readonly db: any
  private readonly tenantId: string

  constructor(private ctx: PluginContext) {
    this.db = ctx.db.drizzle
    this.tenantId = ctx.tenantId

    // 加载内置广告关键词
    this.globalAC.addKeywords(BUILTIN_AD_KEYWORDS)
    this.globalAC.build()
  }

  // ── 初始化：从 DB 加载所有词库 ──────────────────
  async init(): Promise<void> {
    try {
      const allAds = await this.db
        .select()
        .from(pluginFilterAds)
        .where(
          and(
            eq(pluginFilterAds.tenantId, this.tenantId),
            eq(pluginFilterAds.enabled, 1),
          ),
        )

      for (const row of allAds) {
        this.globalAC.addKeyword(row.keyword)
      }
      this.globalAC.build()
      this.ctx.logger.info(`加载 ${allAds.length} 条广告关键词`)
    } catch (err) {
      this.ctx.logger.error('初始化过滤词库失败:', err)
    }
  }

  // ── 获取/懒初始化 guild 的 AC 自动机 ───────────
  private async getGuildAC(guildId: string): Promise<ACAutomaton> {
    if (this.guildAC.has(guildId)) return this.guildAC.get(guildId)!

    const ac = new ACAutomaton()
    const rows = await this.db
      .select()
      .from(pluginFilterAds)
      .where(
        and(
          eq(pluginFilterAds.tenantId, this.tenantId),
          eq(pluginFilterAds.guildId, guildId),
          eq(pluginFilterAds.enabled, 1),
        ),
      )

    for (const row of rows) ac.addKeyword(row.keyword)
    ac.build()
    this.guildAC.set(guildId, ac)
    return ac
  }

  // ── 核心检测方法 ────────────────────────────────
  async check(
    content: string,
    guildId: string,
    userId?: string,
    channelId?: string,
  ): Promise<FilterResult> {
    const config = await this.ctx.getConfig()

    const adDetectionEnabled = config.enable_ad_detection !== false
    const violationDetectionEnabled = config.enable_violation_detection !== false
    const urlCheckEnabled = config.filter_url_check === true

    // 1. 全局广告关键词检测
    if (adDetectionEnabled) {
      const globalHit = this.globalAC.searchFirst(content)
      if (globalHit) {
        return {
          isViolation: true,
          type: 'ad_keyword',
          matchedKeyword: globalHit,
          reason: `包含广告关键词: ${globalHit}`,
        }
      }
    }

    // 2. guild 专属禁用词检测
    if (violationDetectionEnabled) {
      const guildAC = await this.getGuildAC(guildId)
      const guildHit = guildAC.searchFirst(content)
      if (guildHit) {
        return {
          isViolation: true,
          type: 'forbidden_word',
          matchedKeyword: guildHit,
          reason: `包含禁用词: ${guildHit}`,
        }
      }
    }

    // 3. URL 检测
    if (urlCheckEnabled && URL_REGEX.test(content)) {
      return { isViolation: true, type: 'url', reason: '包含链接' }
    }

    // 4. 重复字符检测
    if (violationDetectionEnabled && REPEAT_REGEX.test(content)) {
      return { isViolation: true, type: 'repeat_chars', reason: '包含大量重复字符' }
    }

    return { isViolation: false, type: 'clean' }
  }

  // ── 记录违规 ────────────────────────────────────
  async recordViolation(
    userId: string,
    guildId: string,
    type: string,
    content: string,
    channelId?: string,
  ): Promise<number> {
    await this.db.insert(pluginFilterViolationRecords).values({
      tenantId: this.tenantId,
      userId,
      guildId,
      type,
      content: content.slice(0, 500),
      channelId,
    })

    // 查询该用户本日违规次数
    const today = getChinaDate()
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(pluginFilterViolationRecords)
      .where(
        and(
          eq(pluginFilterViolationRecords.tenantId, this.tenantId),
          eq(pluginFilterViolationRecords.userId, userId),
          eq(pluginFilterViolationRecords.guildId, guildId),
          sql`DATE(created_at) = ${today}`,
        ),
      )
    return row?.count ?? 1
  }

  // ── 动态关键词管理 ──────────────────────────────
  async addKeyword(guildId: string, keyword: string): Promise<void> {
    await this.db
      .insert(pluginFilterAds)
      .values({ tenantId: this.tenantId, guildId, keyword })
      .onDuplicateKeyUpdate({ set: { keyword } })

    const ac = await this.getGuildAC(guildId)
    ac.addKeyword(keyword)
    ac.build()
    this.globalAC.addKeyword(keyword)
    this.globalAC.build()
  }

  async removeKeyword(guildId: string, keyword: string): Promise<void> {
    await this.db
      .delete(pluginFilterAds)
      .where(
        and(
          eq(pluginFilterAds.tenantId, this.tenantId),
          eq(pluginFilterAds.guildId, guildId),
          eq(pluginFilterAds.keyword, keyword),
        ),
      )
    // 重新构建该 guild 的 AC 自动机
    this.guildAC.delete(guildId)
    await this.getGuildAC(guildId)

    // Rebuild global AC from scratch
    this.globalAC = new ACAutomaton()
    this.globalAC.addKeywords(BUILTIN_AD_KEYWORDS)
    const allAds = await this.db
      .select({ keyword: pluginFilterAds.keyword })
      .from(pluginFilterAds)
      .where(and(
        eq(pluginFilterAds.tenantId, this.tenantId),
        eq(pluginFilterAds.enabled, 1),
      ))
    for (const row of allAds) {
      this.globalAC.addKeyword(row.keyword)
    }
    this.globalAC.build()
  }

  // ── 统计信息 ────────────────────────────────────
  getStats() {
    return {
      globalKeywords: this.globalAC.getKeywordCount(),
      guildCount: this.guildAC.size,
    }
  }
}
