import { z } from 'zod'

export const audioPlayerConfigSchema = z.object({
  /** 是否启用 */
  enabled: z.boolean().default(true),
  /** 默认音量 (0-200) */
  default_volume: z.number().int().min(0).max(200).default(80),
  /** 最大队列长度 */
  max_queue_size: z.number().int().min(1).max(500).default(50),
})
