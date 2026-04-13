import { z } from 'zod'

export const keywordReplyConfigSchema = z.object({
  enabled: z.boolean().default(true),
})
