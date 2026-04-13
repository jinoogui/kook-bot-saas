import { z } from 'zod'

export const statisticsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  track_messages: z.boolean().default(true),
})
