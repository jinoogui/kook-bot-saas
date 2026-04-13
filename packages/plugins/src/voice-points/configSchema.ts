import { z } from 'zod'

export const voicePointsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  per_hour: z.number().default(1),
  daily_limit: z.number().default(10),
})
