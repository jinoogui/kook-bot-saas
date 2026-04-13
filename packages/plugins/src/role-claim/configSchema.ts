import { z } from 'zod'

export const roleClaimConfigSchema = z.object({
  enabled: z.boolean().default(true),
})
