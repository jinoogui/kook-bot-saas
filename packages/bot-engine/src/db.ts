import type { TenantDB } from '@kook-saas/shared'

export class TenantDBImpl implements TenantDB {
  readonly drizzle: any
  readonly tenantId: string

  constructor(drizzle: any, tenantId: string) {
    this.drizzle = drizzle
    this.tenantId = tenantId
  }
}
