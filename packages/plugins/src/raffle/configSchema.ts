import { z } from 'zod'

export const raffleConfigSchema = z.object({
  default_duration_minutes: z.number().int().min(1).default(30),
  prevent_repeat_join: z.boolean().default(true),
})
