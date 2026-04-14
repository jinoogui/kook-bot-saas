import {
  createDefaultWelcomeCardModel,
  createId,
  type WelcomeCardModel,
  type WelcomeCardModule,
  type WelcomeModuleType,
} from './welcomeCardModel'

function isModuleType(type: string): type is WelcomeModuleType {
  return ['header', 'section', 'image', 'divider', 'button', 'context'].includes(type)
}

export function toKookCardContent(model: WelcomeCardModel): string {
  const modules = model.modules.map((m) => {
    switch (m.type) {
      case 'header':
        return {
          type: 'header',
          text: { type: 'plain-text', content: m.content || '' },
        }
      case 'section':
        return {
          type: 'section',
          text: { type: 'kmarkdown', content: m.content || '' },
        }
      case 'image':
        return {
          type: 'image-group',
          elements: [{ type: 'image', src: m.src || '' }],
        }
      case 'divider':
        return { type: 'divider' }
      case 'button':
        return {
          type: 'action-group',
          elements: [
            {
              type: 'button',
              theme: m.theme || 'primary',
              value: m.url || '',
              click: 'link',
              text: { type: 'plain-text', content: m.label || '按钮' },
            },
          ],
        }
      case 'context':
        return {
          type: 'context',
          elements: [{ type: 'kmarkdown', content: m.content || '' }],
        }
    }
  })

  return JSON.stringify([
    {
      type: 'card',
      theme: model.theme,
      size: model.size,
      modules,
    },
  ])
}

export function fromKookCardContent(raw: string | undefined | null): WelcomeCardModel {
  if (!raw || !raw.trim()) return createDefaultWelcomeCardModel()

  try {
    const parsed = JSON.parse(raw)
    const card = Array.isArray(parsed) ? parsed[0] : parsed
    if (!card || typeof card !== 'object') return createDefaultWelcomeCardModel()

    const model: WelcomeCardModel = {
      theme: ['primary', 'success', 'warning', 'danger', 'secondary'].includes(card.theme)
        ? card.theme
        : 'primary',
      size: card.size === 'sm' ? 'sm' : 'lg',
      modules: [],
    }

    const rawModules = Array.isArray(card.modules) ? card.modules : []
    for (const rm of rawModules) {
      let moduleType: WelcomeModuleType | null = null
      const next: WelcomeCardModule = {
        id: createId(),
        type: 'section',
      }

      if (rm?.type === 'header') {
        moduleType = 'header'
        next.content = rm?.text?.content ?? ''
      } else if (rm?.type === 'section') {
        moduleType = 'section'
        next.content = rm?.text?.content ?? ''
      } else if (rm?.type === 'image-group') {
        moduleType = 'image'
        next.src = rm?.elements?.[0]?.src ?? ''
      } else if (rm?.type === 'divider') {
        moduleType = 'divider'
      } else if (rm?.type === 'action-group') {
        const btn = rm?.elements?.find((e: any) => e?.type === 'button')
        moduleType = 'button'
        next.label = btn?.text?.content ?? ''
        next.url = btn?.value ?? ''
        next.theme = btn?.theme ?? 'primary'
      } else if (rm?.type === 'context') {
        moduleType = 'context'
        const el = rm?.elements?.find((e: any) => e?.type === 'kmarkdown' || e?.type === 'plain-text')
        next.content = el?.content ?? ''
      }

      if (moduleType && isModuleType(moduleType)) {
        next.type = moduleType
        model.modules.push(next)
      }
    }

    return model.modules.length > 0 ? model : createDefaultWelcomeCardModel()
  } catch {
    return createDefaultWelcomeCardModel()
  }
}
