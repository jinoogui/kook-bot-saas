import { z } from 'zod'

export const ticketConfigSchema = z.object({
  support_channel_id: z.string().default(''),
  support_channel_hint: z.string().default('用于默认受理频道，留空则使用创建时传入的 channelId'),
  default_priority: z.enum(['low', 'normal', 'high']).default('normal'),
  default_priority_hint: z.string().default('新建工单默认优先级，可在创建时覆盖'),
  auto_close_hours: z.number().int().min(0).default(72),
  auto_close_hint: z.string().default('自动关闭阈值（小时）；0 表示关闭自动关闭'),
})
