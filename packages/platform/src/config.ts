import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PLATFORM_PORT: z.coerce.number().default(5000),
  PLATFORM_MYSQL_URL: z.string().min(1, 'PLATFORM_MYSQL_URL is required'),
  TENANT_MYSQL_URL: z.string().min(1, 'TENANT_MYSQL_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  INSTANCE_PORT_START: z.coerce.number().default(6001),
  INSTANCE_PORT_END: z.coerce.number().default(6999),
  BOT_ENGINE_ENTRY: z.string().optional(),
})

export type PlatformConfig = z.infer<typeof configSchema>

export function loadConfig(): PlatformConfig {
  return configSchema.parse(process.env)
}
