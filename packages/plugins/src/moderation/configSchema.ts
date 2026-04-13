import { z } from 'zod'

export const moderationConfigSchema = z.object({
  /** 是否启用管理工具 */
  enabled: z.boolean().default(true),
  /** 自动封禁违规次数阈值 */
  auto_ban_violations: z.number().default(5),
  /** 自动禁言时长（小时） */
  auto_mute_hours: z.number().default(1),
})
