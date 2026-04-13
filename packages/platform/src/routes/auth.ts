import type { FastifyInstance } from 'fastify'
import type { AuthService } from '../services/AuthService.js'

export function registerAuthRoutes(app: FastifyInstance, authService: AuthService) {
  // 注册
  app.post('/api/auth/register', async (request, reply) => {
    try {
      const { email, username, password } = request.body as any
      if (!email || !username || !password) {
        return reply.code(400).send({ error: '请填写完整信息' })
      }
      if (password.length < 6) {
        return reply.code(400).send({ error: '密码至少6位' })
      }
      const result = await authService.register(email, username, password)
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })

  // 登录
  app.post('/api/auth/login', async (request, reply) => {
    try {
      const { email, password } = request.body as any
      if (!email || !password) {
        return reply.code(400).send({ error: '请填写邮箱和密码' })
      }
      const result = await authService.login(email, password)
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.code(401).send({ error: err.message })
    }
  })

  // 获取当前用户信息
  app.get('/api/auth/me', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any
    const user = await authService.getUser(userId)
    if (!user) return reply.code(404).send({ error: '用户不存在' })
    return reply.send({ success: true, data: user })
  })

  // 修改密码
  app.post('/api/auth/change-password', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as any
      const { oldPassword, newPassword } = request.body as any
      await authService.updatePassword(userId, oldPassword, newPassword)
      return reply.send({ success: true, message: '密码修改成功' })
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })
}
