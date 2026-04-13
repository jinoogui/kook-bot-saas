/**
 * 命令定义类型
 */

import type { KookMessageEvent } from './events.js'
import type { PluginContext } from './plugin.js'

export interface CommandDefinition {
  /** 命令名（主命令，不含前缀） */
  name: string
  /** 别名列表，如 ['签到', '打卡', 'checkin'] */
  aliases: string[]
  /** 命令描述 */
  description: string
  /** 权限要求 */
  permission?: 'everyone' | 'admin' | 'owner'
  /** 命令处理器 */
  handler: (event: KookMessageEvent, args: string[], ctx: PluginContext) => Promise<void>
}

export interface CommandParseResult {
  /** 解析出的命令名 */
  cmd: string
  /** 命令参数列表 */
  args: string[]
  /** 原始内容 */
  raw: string
}
