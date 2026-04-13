import { eq, and, gte, lte, count, desc, sql } from 'drizzle-orm'
import type { PlatformDB } from '../db/index.js'
import { auditLogs, platformUsers } from '../db/schema/index.js'

export interface AuditLogEntry {
  userId: number
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}

export interface AuditQueryParams {
  action?: string
  userId?: number
  startDate?: string
  endDate?: string
  page?: number
  size?: number
}

export class AuditService {
  constructor(private db: PlatformDB) {}

  /** 写入审计记录 */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress ?? null,
      })
    } catch (err) {
      // 审计日志写入失败不应影响主流程
      console.error('[AuditService] 写入审计日志失败:', err)
    }
  }

  /** 分页查询审计日志 */
  async query(params: AuditQueryParams) {
    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(100, Math.max(1, params.size ?? 20))
    const offset = (page - 1) * size

    const conditions = []
    if (params.action) {
      conditions.push(eq(auditLogs.action, params.action))
    }
    if (params.userId) {
      conditions.push(eq(auditLogs.userId, params.userId))
    }
    if (params.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(params.startDate)))
    }
    if (params.endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(params.endDate)))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          action: auditLogs.action,
          resource: auditLogs.resource,
          resourceId: auditLogs.resourceId,
          details: auditLogs.details,
          ipAddress: auditLogs.ipAddress,
          createdAt: auditLogs.createdAt,
          username: platformUsers.username,
          email: platformUsers.email,
        })
        .from(auditLogs)
        .leftJoin(platformUsers, eq(auditLogs.userId, platformUsers.id))
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(auditLogs)
        .where(where),
    ])

    return {
      rows,
      total: total.value,
      page,
      size,
    }
  }
}
