import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import jwt from '@fastify/jwt'

export async function createServer(opts: {
  jwtSecret: string
  port: number
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
  await app.register(cors, { origin: true, credentials: true })
  await app.register(formbody)
  await app.register(jwt, { secret: opts.jwtSecret })

  // JWT 认证 decorator
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ error: '未登录或 Token 已过期' })
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
  }
}
