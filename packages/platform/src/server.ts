import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { eq } from 'drizzle-orm'
import type { PlatformDB } from './db/index.js'
import { platformUsers } from './db/schema/index.js'

export async function createServer(opts: {
  jwtSecret: string
  port: number
  db: PlatformDB
  redisUrl?: string
  rateLimitGeneral?: number
}) {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  // 插件
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : ['http://localhost:5173']
  await app.register(cors, { origin: corsOrigin, credentials: true })
  await app.register(formbody)
  await app.register(jwt, { secret: opts.jwtSecret })

  // 全局速率限制
  await app.register(rateLimit, {
    max: opts.rateLimitGeneral ?? 60,
    timeWindow: '1 minute',
    keyGenerator: (request: any) => {
      // 已认证用户用 userId，未认证用 IP
      try {
        const decoded = app.jwt.decode(
          request.headers.authorization?.replace('Bearer ', '') || ''
        ) as any
        if (decoded?.userId) return `user:${decoded.userId}`
      } catch {}
      return request.ip
    },
    errorResponseBuilder: () => ({
      error: '请求过于频繁，请稍后再试',
      statusCode: 429,
    }),
  })

  // JWT 认证 decorator
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      return reply.code(401).send({ error: '未登录或 Token 已过期' })
    }
  })

  // 管理员专属路由守卫（查 DB 确认角色）
  app.decorate('requireAdmin', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
      const userId = request.user?.userId
      if (!userId) {
        return reply.code(401).send({ error: '未登录或 Token 已过期' })
      }
      const [user] = await opts.db
        .select({ role: platformUsers.role })
        .from(platformUsers)
        .where(eq(platformUsers.id, userId))
        .limit(1)
      if (!user || user.role !== 'admin') {
        return reply.code(403).send({ error: '需要管理员权限' })
      }
    } catch (err) {
      return reply.code(401).send({ error: '未登录或 Token 已过期' })
    }
  })

  // 健康检查
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: Date.now() }
  })

  return app
}

// Fastify 类型扩展
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
    requireAdmin: (request: any, reply: any) => Promise<void>
  }
}
