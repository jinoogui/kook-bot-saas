import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { z } from 'zod'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PLATFORM_PORT: z.coerce.number().default(5000),
  PLATFORM_MYSQL_URL: z.string().min(1, 'PLATFORM_MYSQL_URL is required'),
  TENANT_MYSQL_URL: z.string().min(1, 'TENANT_MYSQL_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CORS_ORIGIN: z.string().optional().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  INSTANCE_PORT_START: z.coerce.number().optional(),
  INSTANCE_PORT_END: z.coerce.number().optional(),
  RUNTIME_API_PORT_START: z.coerce.number().default(22000),
  RUNTIME_API_PORT_END: z.coerce.number().default(22999),
  BOT_ENGINE_ENTRY: z.string().optional(),
  RATE_LIMIT_AUTH: z.coerce.number().default(5),       // 认证接口：5次/分钟
  RATE_LIMIT_GENERAL: z.coerce.number().default(60),   // 通用接口：60次/分钟
  RATE_LIMIT_ADMIN: z.coerce.number().default(120),    // 管理接口：120次/分钟
  MONITOR_ALERT_WEBHOOK: z.string().optional(),
  ALERT_WEBHOOK: z.string().optional(),
})

export type PlatformConfig = z.infer<typeof configSchema>

export function loadConfig(): PlatformConfig {
  return configSchema.parse(process.env)
}
