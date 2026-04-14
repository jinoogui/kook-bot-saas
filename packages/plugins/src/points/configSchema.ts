import { z } from 'zod'

export const pointsConfigSchema = z.object({
  /** 签到命令名 */
  checkin_command: z.string().default('签到'),
  /** 积分查询命令名 */
  points_command: z.string().default('积分'),
  /** 排行榜命令名 */
  rank_command: z.string().default('排行榜'),
  /** 商店命令名 */
  shop_command: z.string().default('商店'),
  /** 购买命令名 */
  buy_command: z.string().default('购买'),
  /** 宝箱命令名 */
  box_command: z.string().default('宝箱'),
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
