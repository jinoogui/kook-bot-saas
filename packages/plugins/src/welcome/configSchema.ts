import { z } from 'zod'

export const welcomeConfigSchema = z.object({
  /** 是否启用欢迎消息 */
  enabled: z.boolean().default(true),
  /** 欢迎消息模板 */
  welcome_message: z.string().default('欢迎 {user} 加入服务器！'),
  /** 欢迎消息频道 ID */
  welcome_channel_id: z.string().default(''),
  /** 消息类型: kmarkdown | card */
  message_type: z.enum(['kmarkdown', 'card']).default('kmarkdown'),
  /** 卡片内容 JSON */
  card_content: z.string().default(''),
  /** 是否启用欢送消息 */
  goodbye_enabled: z.boolean().default(false),
  /** 欢送消息模板 */
  goodbye_message: z.string().default('{username} 离开了服务器，再见！'),
  /** 欢送消息频道 ID */
  goodbye_channel_id: z.string().default(''),
})
