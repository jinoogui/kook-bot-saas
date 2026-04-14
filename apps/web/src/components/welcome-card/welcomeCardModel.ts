export type WelcomeModuleType = 'header' | 'section' | 'image' | 'divider' | 'button' | 'context'

export interface WelcomeCardModule {
  id: string
  type: WelcomeModuleType
  content?: string
  src?: string
  label?: string
  url?: string
  theme?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary'
}

export interface WelcomeCardModel {
  theme: 'primary' | 'success' | 'warning' | 'danger' | 'secondary'
  size: 'sm' | 'lg'
  modules: WelcomeCardModule[]
}

export function createId(): string {
  const maybeCrypto = (globalThis as any).crypto
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return maybeCrypto.randomUUID()
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function createDefaultWelcomeCardModel(): WelcomeCardModel {
  return {
    theme: 'primary',
    size: 'lg',
    modules: [
      {
        id: createId(),
        type: 'header',
        content: '欢迎新成员加入',
      },
      {
        id: createId(),
        type: 'section',
        content: '欢迎 {user} 来到服务器，祝你玩得开心。',
      },
    ],
  }
}

export const DEFAULT_WELCOME_CARD_MODEL: WelcomeCardModel = createDefaultWelcomeCardModel()

export function createModule(type: WelcomeModuleType): WelcomeCardModule {
  switch (type) {
    case 'header':
      return { id: createId(), type, content: '卡片标题' }
    case 'section':
      return { id: createId(), type, content: '正文内容，支持 {user} / {username} 变量' }
    case 'image':
      return { id: createId(), type, src: 'https://img.kookapp.cn/assets/icon.png' }
    case 'divider':
      return { id: createId(), type }
    case 'button':
      return {
        id: createId(),
        type,
        label: '点击查看',
        url: 'https://www.kookapp.cn',
        theme: 'primary',
      }
    case 'context':
      return { id: createId(), type, content: '欢迎消息由机器人自动发送' }
  }
}
