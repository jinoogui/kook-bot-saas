import { z } from 'zod'

export const antiSpamConfigSchema = z.object({
  enabled: z.boolean().default(true),
  default_action: z.enum(['warn', 'mute', 'delete']).default('warn'),
  default_window_seconds: z.number().int().min(3).max(120).default(10),
  default_max_messages: z.number().int().min(2).max(30).default(6),
  default_duplicate_threshold: z.number().int().min(2).max(20).default(3),
  default_block_at_all: z.boolean().default(true),
  default_mute_hours: z.number().int().min(1).max(168).default(1),
})
