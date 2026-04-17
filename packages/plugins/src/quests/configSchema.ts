import { z } from 'zod'

export const questsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  auto_claim: z.boolean().default(false),
  daily_reset_hour: z.number().int().min(0).max(23).default(4),
  message_quest_code: z.string().default(''),
})
