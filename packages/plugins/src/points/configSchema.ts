import { z } from 'zod'

export const pointsConfigSchema = z.object({
  /** 签到最小积分 */
  checkin_min_points: z.number().int().min(0).default(10),
  /** 签到最大积分 */
  checkin_max_points: z.number().int().min(0).default(50),
  /** 是否启用连签奖励 */
  checkin_streak_enabled: z.boolean().default(true),
  /** 连签奖励最小积分 */
  checkin_streak_min: z.number().int().min(0).default(20),
  /** 连签奖励最大积分 */
  checkin_streak_max: z.number().int().min(0).default(50),
  /** 宝箱花费积分 */
  box_cost: z.number().int().min(0).default(100),
  /** 宝箱最小奖励 */
  box_min_reward: z.number().int().min(0).default(10),
  /** 宝箱最大奖励 */
  box_max_reward: z.number().int().min(0).default(200),
  /** 宝箱冷却时间（秒） */
  box_cooldown: z.number().int().min(0).default(3600),
})
