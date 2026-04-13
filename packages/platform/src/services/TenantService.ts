import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import type { PlatformDB } from '../db/index.js'
import { tenants } from '../db/schema/index.js'
import { encryptToken, decryptToken } from '@kook-saas/shared'

export class TenantService {
  constructor(
    private db: PlatformDB,
    private tokenSecret: string,
  ) {}

  async create(userId: number, name: string, botToken: string, verifyToken?: string, encryptKey?: string) {
    const id = randomUUID()
    const encryptedToken = encryptToken(botToken, this.tokenSecret)

    await this.db.insert(tenants).values({
      id,
      userId,
      name,
      botToken: encryptedToken,
      verifyToken: verifyToken ?? null,
      encryptKey: encryptKey ?? null,
    })

    return { id, name }
  }

  async getByUser(userId: number) {
    return this.db
      .select({
        id: tenants.id,
        name: tenants.name,
        status: tenants.status,
        assignedPort: tenants.assignedPort,
        lastHeartbeat: tenants.lastHeartbeat,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .where(eq(tenants.userId, userId))
  }

  async getById(tenantId: string) {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)
    return tenant ?? null
  }

  async getDecryptedToken(tenantId: string): Promise<string | null> {
    const tenant = await this.getById(tenantId)
    if (!tenant) return null
    try {
      return decryptToken(tenant.botToken, this.tokenSecret)
    } catch {
      return null
    }
  }

  async update(tenantId: string, userId: number, data: {
    name?: string
    botToken?: string
    verifyToken?: string
    encryptKey?: string
  }) {
    const updates: Record<string, any> = {}
    if (data.name) updates.name = data.name
    if (data.botToken) updates.botToken = encryptToken(data.botToken, this.tokenSecret)
    if (data.verifyToken !== undefined) updates.verifyToken = data.verifyToken
    if (data.encryptKey !== undefined) updates.encryptKey = data.encryptKey

    if (Object.keys(updates).length === 0) return

    await this.db
      .update(tenants)
      .set(updates)
      .where(and(eq(tenants.id, tenantId), eq(tenants.userId, userId)))
  }

  async delete(tenantId: string, userId: number) {
    await this.db
      .delete(tenants)
      .where(and(eq(tenants.id, tenantId), eq(tenants.userId, userId)))
  }

  async updateStatus(tenantId: string, status: string, pid?: number | null, port?: number | null) {
    const updates: Record<string, any> = { status }
    if (pid !== undefined) updates.pid = pid
    if (port !== undefined) updates.assignedPort = port
    if (status === 'running') updates.lastHeartbeat = new Date()

    await this.db
      .update(tenants)
      .set(updates)
      .where(eq(tenants.id, tenantId))
  }

  async updateHeartbeat(tenantId: string) {
    await this.db
      .update(tenants)
      .set({ lastHeartbeat: new Date() })
      .where(eq(tenants.id, tenantId))
  }

  async getAllRunning() {
    return this.db
      .select({
        id: tenants.id,
        userId: tenants.userId,
        name: tenants.name,
        verifyToken: tenants.verifyToken,
        encryptKey: tenants.encryptKey,
        assignedPort: tenants.assignedPort,
        status: tenants.status,
        pid: tenants.pid,
        lastHeartbeat: tenants.lastHeartbeat,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      })
      .from(tenants)
      .where(eq(tenants.status, 'running'))
  }

  async getAllTenants() {
    return this.db
      .select({
        id: tenants.id,
        userId: tenants.userId,
        name: tenants.name,
        verifyToken: tenants.verifyToken,
        encryptKey: tenants.encryptKey,
        assignedPort: tenants.assignedPort,
        status: tenants.status,
        pid: tenants.pid,
        lastHeartbeat: tenants.lastHeartbeat,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      })
      .from(tenants)
  }

  /** 验证租户归属 */
  async verifyOwnership(tenantId: string, userId: number): Promise<boolean> {
    const [tenant] = await this.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(and(eq(tenants.id, tenantId), eq(tenants.userId, userId)))
      .limit(1)
    return !!tenant
  }
}
