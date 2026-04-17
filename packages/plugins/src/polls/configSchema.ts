import { z } from 'zod'

export const pollsConfigSchema = z.object({
  default_duration_minutes: z.number().int().min(1).default(30),
  default_allow_multi: z.boolean().default(false),
})
