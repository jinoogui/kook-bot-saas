import { z } from 'zod'

export const eventsConfigSchema = z.object({
  reminder_before_minutes: z.number().int().min(1).default(30),
  default_max_participants: z.number().int().min(0).default(0),
})
