import type { Redis } from 'ioredis'
import type { ScopedRedis as IScopedRedis } from '@kook-saas/shared'

export class ScopedRedisImpl implements IScopedRedis {
  private readonly prefix: string

  constructor(
    private readonly redis: Redis,
    tenantId: string,
  ) {
    this.prefix = `tenant:${tenantId}:`
  }

  private key(k: string): string {
    return `${this.prefix}${k}`
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(this.key(key))
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<string | null> {
    if (mode && duration) {
      return this.redis.set(this.key(key), value, mode as 'EX' | 'PX', duration)
    }
    return this.redis.set(this.key(key), value)
  }

  async del(key: string): Promise<number> {
    return this.redis.del(this.key(key))
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(this.key(key))
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.redis.expire(this.key(key), seconds)
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(this.key(key))
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.redis.sadd(this.key(key), ...members)
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.redis.srem(this.key(key), ...members)
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(this.key(key))
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.redis.sismember(this.key(key), member)
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.redis.hset(this.key(key), field, value)
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(this.key(key), field)
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(this.key(key))
  }

  async hdel(key: string, field: string): Promise<number> {
    return this.redis.hdel(this.key(key), field)
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(this.key(pattern))
  }
}
