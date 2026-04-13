import { eq, and, like, count, desc } from 'drizzle-orm'
import type { PlatformDB } from '../db/index.js'
import { instanceLogs } from '../db/schema/index.js'

export interface LogEntry {
  tenantId: string
  level: 'info' | 'warn' | 'error'
  message: string
  metadata?: Record<string, unknown>
}

export interface LogQueryParams {
  tenantId: string
  level?: string
  search?: string
  page?: number
  size?: number
}

export class LogService {
  constructor(private db: PlatformDB) {}

  /** 写入实例日志 */
  async writeLog(entry: LogEntry): Promise<void> {
    try {
      await this.db.insert(instanceLogs).values({
        tenantId: entry.tenantId,
        level: entry.level,
        message: entry.message,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      })
    } catch (err) {
      console.error('[LogService] 写入日志失败:', err)
    }
  }

  /** 分页查询实例日志 */
  async queryLogs(params: LogQueryParams) {
    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(100, Math.max(1, params.size ?? 50))
    const offset = (page - 1) * size

    const conditions = [eq(instanceLogs.tenantId, params.tenantId)]
    if (params.level && params.level !== 'all') {
      conditions.push(eq(instanceLogs.level, params.level))
    }
    if (params.search) {
      conditions.push(like(instanceLogs.message, `%${params.search}%`))
    }

    const where = and(...conditions)

    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          id: instanceLogs.id,
          tenantId: instanceLogs.tenantId,
          level: instanceLogs.level,
          message: instanceLogs.message,
          metadata: instanceLogs.metadata,
          createdAt: instanceLogs.createdAt,
        })
        .from(instanceLogs)
        .where(where)
        .orderBy(desc(instanceLogs.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(instanceLogs)
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
