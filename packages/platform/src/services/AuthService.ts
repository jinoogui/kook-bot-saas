import { eq } from 'drizzle-orm'
import { hash, verify } from '@node-rs/bcrypt'
import type { FastifyInstance } from 'fastify'
import type { PlatformDB } from '../db/index.js'
import { platformUsers } from '../db/schema/index.js'

export class AuthService {
  constructor(
    private db: PlatformDB,
    private app: FastifyInstance,
  ) {}

  async register(email: string, username: string, password: string) {
    // 检查邮箱是否已存在
    const [existing] = await this.db
      .select({ id: platformUsers.id })
      .from(platformUsers)
      .where(eq(platformUsers.email, email))
      .limit(1)

    if (existing) {
      throw new Error('该邮箱已注册')
    }

    // 哈希密码
    const passwordHash = await hash(password, 10)

    // 创建用户
    const [result] = await this.db.insert(platformUsers).values({
      email,
      username,
      passwordHash,
    })

    const userId = (result as any).insertId as number

    // 生成 JWT
    const token = this.app.jwt.sign({ userId, email, username }, { expiresIn: '7d' })

    return { userId, token, username }
  }

  async login(email: string, password: string) {
    const [user] = await this.db
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.email, email))
      .limit(1)

    if (!user) {
      throw new Error('邮箱或密码错误')
    }

    if (user.status !== 'active') {
      throw new Error('账户已被禁用')
    }

    const valid = await verify(password, user.passwordHash)
    if (!valid) {
      throw new Error('邮箱或密码错误')
    }

    const token = this.app.jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      { expiresIn: '7d' },
    )

    return { userId: user.id, token, username: user.username }
  }

  async getUser(userId: number) {
    const [user] = await this.db
      .select({
        id: platformUsers.id,
        email: platformUsers.email,
        username: platformUsers.username,
        status: platformUsers.status,
        createdAt: platformUsers.createdAt,
      })
      .from(platformUsers)
      .where(eq(platformUsers.id, userId))
      .limit(1)

    return user ?? null
  }

  async updatePassword(userId: number, oldPassword: string, newPassword: string) {
    const [user] = await this.db
      .select({ passwordHash: platformUsers.passwordHash })
      .from(platformUsers)
      .where(eq(platformUsers.id, userId))
      .limit(1)

    if (!user) throw new Error('用户不存在')

    const valid = await verify(oldPassword, user.passwordHash)
    if (!valid) throw new Error('原密码错误')

    const passwordHash = await hash(newPassword, 10)
    await this.db
      .update(platformUsers)
      .set({ passwordHash })
      .where(eq(platformUsers.id, userId))
  }
}
