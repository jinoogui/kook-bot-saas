import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema/index.js'

export type PlatformDB = ReturnType<typeof drizzle>

let pool: mysql.Pool | null = null
let db: PlatformDB | null = null

export async function initPlatformDB(url: string): Promise<PlatformDB> {
  if (db) return db

  pool = mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })

  // 验证连接
  const conn = await pool.getConnection()
  await conn.ping()
  conn.release()

  db = drizzle(pool, { schema, mode: 'default' }) as unknown as PlatformDB
  console.info('[PlatformDB] Connected to platform database')
  return db as PlatformDB
}

export async function closePlatformDB(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    db = null
    console.info('[PlatformDB] Connection closed')
  }
}

export function getPlatformDB(): PlatformDB {
  if (!db) throw new Error('Platform DB not initialized. Call initPlatformDB first.')
  return db as PlatformDB
}

export { schema }
