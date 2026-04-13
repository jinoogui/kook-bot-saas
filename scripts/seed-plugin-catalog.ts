/**
 * 初始化插件目录数据
 * 运行: npx tsx scripts/seed-plugin-catalog.ts
 */

import type { PluginMetadata } from '@kook-saas/shared'

export const PLUGIN_CATALOG: PluginMetadata[] = [
  {
    id: 'welcome',
    name: '欢迎消息',
    description: '新成员入群/退群时自动发送欢迎或欢送消息，支持 KMarkdown 和卡片消息模式',
    version: '1.0.0',
    category: 'social',
    dependencies: [],
    tier: 'free',
  },
  {
    id: 'points',
    name: '积分系统',
    description: '签到获取积分、积分商店兑换、宝箱抽奖、排行榜等完整积分经济系统',
    version: '1.0.0',
    category: 'engagement',
    dependencies: [],
    tier: 'free',
  },
  {
    id: 'content-filter',
    name: '内容过滤',
    description: '基于 AC 自动机的高效敏感词过滤，支持广告检测、URL 拦截、刷屏检测',
    version: '1.0.0',
    category: 'moderation',
    dependencies: [],
    tier: 'free',
  },
  {
    id: 'reminders',
    name: '定时提醒',
    description: '支持相对/绝对时间设置提醒，到时自动在频道发送卡片通知',
    version: '1.0.0',
    category: 'utility',
    dependencies: [],
    tier: 'free',
  },
  {
    id: 'voice-points',
    name: '语音积分',
    description: '用户在语音频道中每小时自动获得积分奖励',
    version: '1.0.0',
    category: 'engagement',
    dependencies: ['points'],
    tier: 'paid',
    priceMonthly: 1000,
    priceYearly: 10000,
  },
  {
    id: 'levels',
    name: '等级系统',
    description: '消息经验值、等级进度条、升级通知',
    version: '1.0.0',
    category: 'engagement',
    dependencies: [],
    tier: 'paid',
    priceMonthly: 500,
    priceYearly: 5000,
  },
  {
    id: 'keyword-reply',
    name: '关键词回复',
    description: '自动关键词触发回复，支持精确/前缀/后缀/包含四种匹配模式',
    version: '1.0.0',
    category: 'utility',
    dependencies: [],
    tier: 'paid',
    priceMonthly: 500,
    priceYearly: 5000,
  },
  {
    id: 'moderation',
    name: '管理工具',
    description: '封禁/禁言管理、广告词库管理',
    version: '1.0.0',
    category: 'moderation',
    dependencies: [],
    tier: 'paid',
    priceMonthly: 800,
    priceYearly: 8000,
  },
  {
    id: 'role-claim',
    name: '身份组领取',
    description: '通过按钮卡片让用户自助领取/移除身份组',
    version: '1.0.0',
    category: 'social',
    dependencies: [],
    tier: 'paid',
    priceMonthly: 300,
    priceYearly: 3000,
  },
  {
    id: 'statistics',
    name: '活跃统计',
    description: '消息计数、在线人数趋势、活跃用户排行',
    version: '1.0.0',
    category: 'utility',
    dependencies: [],
    tier: 'paid',
    priceMonthly: 500,
    priceYearly: 5000,
  },
  {
    id: 'audio-player',
    name: '音频播放',
    description: '语音频道音频播放功能',
    version: '1.0.0',
    category: 'media',
    dependencies: [],
    tier: 'paid',
    priceMonthly: 1500,
    priceYearly: 15000,
  },
]

// 如果直接运行此脚本
const isMain = process.argv[1]?.endsWith('seed-plugin-catalog.ts') ||
               process.argv[1]?.endsWith('seed-plugin-catalog.js')

if (isMain) {
  console.info('插件目录数据:')
  for (const p of PLUGIN_CATALOG) {
    const price = p.tier === 'free' ? '免费' : `¥${(p.priceMonthly ?? 0) / 100}/月`
    console.info(`  [${p.tier.padEnd(4)}] ${p.id.padEnd(16)} ${p.name.padEnd(8)} ${price}`)
  }
  console.info(`\n共 ${PLUGIN_CATALOG.length} 个插件`)
}
