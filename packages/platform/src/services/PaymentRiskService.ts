import { and, count, eq, gte } from 'drizzle-orm'
import type { PlatformDB } from '../db/index.js'
import { payments } from '../db/schema/index.js'

export type PaymentRiskDecision = 'pass' | 'review' | 'reject'

export interface PaymentRiskInput {
  userId: number
  tenantId: string
  pluginId: string
  amount: number
}

export interface PaymentRiskEvaluation {
  decision: PaymentRiskDecision
  reason: string | null
  recentOrderCount: number
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export class PaymentRiskService {
  private readonly enabled: boolean
  private readonly windowMinutes: number
  private readonly reviewOrderThreshold: number
  private readonly rejectOrderThreshold: number
  private readonly reviewAmountThreshold: number
  private readonly rejectAmountThreshold: number

  constructor(private db: PlatformDB) {
    this.enabled = process.env.PAYMENT_RISK_ENABLED !== 'false'
    this.windowMinutes = parseIntEnv(process.env.PAYMENT_RISK_WINDOW_MINUTES, 5)
    this.reviewOrderThreshold = parseIntEnv(process.env.PAYMENT_RISK_REVIEW_ORDER_THRESHOLD, 3)
    this.rejectOrderThreshold = parseIntEnv(process.env.PAYMENT_RISK_REJECT_ORDER_THRESHOLD, 6)
    this.reviewAmountThreshold = parseIntEnv(process.env.PAYMENT_RISK_REVIEW_AMOUNT_THRESHOLD, 50_000)
    this.rejectAmountThreshold = parseIntEnv(process.env.PAYMENT_RISK_REJECT_AMOUNT_THRESHOLD, 200_000)
  }

  async evaluateCreateOrder(input: PaymentRiskInput): Promise<PaymentRiskEvaluation> {
    if (!this.enabled) {
      return { decision: 'pass', reason: null, recentOrderCount: 0 }
    }

    const windowStart = new Date(Date.now() - this.windowMinutes * 60 * 1000)
    const [orderCountResult] = await this.db
      .select({ value: count() })
      .from(payments)
      .where(and(
        eq(payments.userId, input.userId),
        eq(payments.tenantId, input.tenantId),
        eq(payments.pluginId, input.pluginId),
        gte(payments.createdAt, windowStart),
      ))

    const recentOrderCount = orderCountResult?.value ?? 0

    if (recentOrderCount >= this.rejectOrderThreshold) {
      return {
        decision: 'reject',
        reason: `同租户同插件 ${this.windowMinutes} 分钟内下单 ${recentOrderCount} 次，触发自动拒绝`,
        recentOrderCount,
      }
    }

    if (input.amount >= this.rejectAmountThreshold) {
      return {
        decision: 'reject',
        reason: `订单金额达到 ¥${(input.amount / 100).toFixed(2)}，触发高额自动拒绝`,
        recentOrderCount,
      }
    }

    const reviewReasons: string[] = []
    if (recentOrderCount >= this.reviewOrderThreshold) {
      reviewReasons.push(`同租户同插件 ${this.windowMinutes} 分钟内下单 ${recentOrderCount} 次`)
    }
    if (input.amount >= this.reviewAmountThreshold) {
      reviewReasons.push(`订单金额达到 ¥${(input.amount / 100).toFixed(2)}`)
    }

    if (reviewReasons.length > 0) {
      return {
        decision: 'review',
        reason: `${reviewReasons.join('；')}，需人工复核`,
        recentOrderCount,
      }
    }

    return { decision: 'pass', reason: null, recentOrderCount }
  }
}
