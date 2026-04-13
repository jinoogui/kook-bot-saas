import { z } from 'zod'

export const levelConfigSchema = z.object({
  /** 是否启用等级系统 */
  enabled: z.boolean().default(false),
  /** 每条消息获得的经验值 */
  xp_per_message: z.number().default(10),
  /** 经验值冷却时间（秒） */
  xp_cooldown: z.number().default(60),
  /** 升级通知频道 ID */
  level_up_channel: z.string().default(''),
})
