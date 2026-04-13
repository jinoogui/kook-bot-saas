/**
 * Kook 事件类型定义
 */

export type KookEventType =
  | 'message'
  | 'joined_guild'
  | 'exited_guild'
  | 'joined_channel'
  | 'exited_channel'
  | 'message_btn_click'
  | 'updated_message'
  | 'deleted_message'
  | 'added_reaction'
  | 'deleted_reaction'
  | 'updated_guild'
  | 'added_role'
  | 'deleted_role'
  | 'updated_role'
  | 'updated_channel'
  | 'pinned_message'
  | 'unpinned_message'

export interface KookUser {
  id: string
  username: string
  nickname?: string
  avatar?: string
  online?: boolean
  bot?: boolean
  roles?: number[]
}

export interface KookEvent {
  /** 消息类型: 1=文本, 9=KMarkdown, 10=卡片, 255=系统 */
  type: number
  /** 频道ID (对于频道消息) */
  target_id: string
  /** 消息发送者ID */
  author_id: string
  /** 消息内容 */
  content: string
  /** 消息ID */
  msg_id: string
  /** 消息时间戳(ms) */
  msg_timestamp: number
  /** 随机数，用于去重 */
  nonce: string
  /** 扩展信息 */
  extra: KookEventExtra
}

export interface KookEventExtra {
  /** 事件子类型 */
  type: string | number
  /** 服务器ID */
  guild_id?: string
  /** 频道名称 */
  channel_name?: string
  /** 消息发送者信息 */
  author?: KookUser
  /** 系统事件体 */
  body?: Record<string, any>
  /** @提及的用户 */
  mention?: string[]
  /** 是否@全体 */
  mention_all?: boolean
}

export interface KookMessageEvent extends KookEvent {
  type: 1 | 9 | 10
  extra: KookEventExtra & {
    type: 1 | 9 | 10
    guild_id: string
    author: KookUser
  }
}

export interface KookSystemEvent extends KookEvent {
  type: 255
  extra: KookEventExtra & {
    type: string
    body: Record<string, any>
  }
}

export interface KookButtonClickEvent {
  type: 255
  extra: {
    type: 'message_btn_click'
    body: {
      user_id: string
      guild_id?: string
      target_id?: string
      msg_id?: string
      value: string
      user_info?: KookUser
    }
  }
}
