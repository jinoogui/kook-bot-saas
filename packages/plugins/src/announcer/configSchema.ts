import { z } from 'zod'

export const announcerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  max_retry: z.number().int().min(0).max(10).default(3),
  retry_delay_minutes: z.number().int().min(1).max(120).default(5),
})
