import {
  AlignLeft,
  Heading1,
  Image,
  Layers3,
  Minus,
  MousePointerClick,
  Quote,
} from 'lucide-react'
import type { WelcomeModuleType } from './welcomeCardModel'

interface Props {
  onDragStart: (type: WelcomeModuleType, e: React.DragEvent<HTMLButtonElement>) => void
  onAdd: (type: WelcomeModuleType) => void
}

const ITEM_TYPES: Array<{ type: WelcomeModuleType; label: string; desc: string; icon: typeof Layers3 }> = [
  { type: 'header', label: '标题', desc: '卡片头部标题', icon: Heading1 },
  { type: 'section', label: '正文', desc: '支持 KMarkdown 文本', icon: AlignLeft },
  { type: 'image', label: '图片', desc: '单图模块', icon: Image },
  { type: 'divider', label: '分割线', desc: '视觉分隔', icon: Minus },
  { type: 'button', label: '按钮', desc: '跳转链接按钮', icon: MousePointerClick },
  { type: 'context', label: '上下文', desc: '辅助说明文字', icon: Quote },
]

export function WelcomeCardPalette({ onDragStart, onAdd }: Props) {
  return (
    <div className="space-y-2.5">
      {ITEM_TYPES.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.type}
            type="button"
            draggable
            onDragStart={(e) => onDragStart(item.type, e)}
            onClick={() => onAdd(item.type)}
            className="group w-full text-left rounded-xl border border-gray-200 bg-white px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg border border-primary-100 bg-primary-50 p-1.5 text-primary-600">
                <Icon size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
                <p className="mt-1 text-[11px] text-gray-400">点击添加或拖拽到画布</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
