import { GripVertical } from 'lucide-react'
import type { WelcomeCardModule, WelcomeModuleType } from './welcomeCardModel'

interface Props {
  modules: WelcomeCardModule[]
  selectedId: string | null
  onSelect: (id: string) => void
  onMove: (from: number, to: number) => void
  onDropNew: (type: WelcomeModuleType, index?: number) => void
}

function moduleTitle(module: WelcomeCardModule): string {
  switch (module.type) {
    case 'header': return `标题: ${module.content || ''}`
    case 'section': return `正文: ${(module.content || '').slice(0, 36)}`
    case 'image': return `图片: ${module.src || ''}`
    case 'divider': return '分割线'
    case 'button': return `按钮: ${module.label || ''}`
    case 'context': return `上下文: ${(module.content || '').slice(0, 36)}`
  }
}

export function WelcomeCardCanvas({
  modules,
  selectedId,
  onSelect,
  onMove,
  onDropNew,
}: Props) {
  const handleDrop = (targetIndex?: number, e?: React.DragEvent<HTMLDivElement>) => {
    if (!e) return
    e.preventDefault()
    const paletteType = e.dataTransfer.getData('application/x-welcome-module') as WelcomeModuleType
    const movedIndex = e.dataTransfer.getData('application/x-welcome-index')

    if (paletteType) {
      onDropNew(paletteType, targetIndex)
      return
    }

    if (movedIndex !== '') {
      const from = Number(movedIndex)
      if (Number.isInteger(from) && targetIndex !== undefined && from !== targetIndex) {
        onMove(from, targetIndex)
      }
    }
  }

  return (
    <div
      className="min-h-[360px] space-y-2.5 rounded-xl border border-dashed border-primary-200 bg-gradient-to-b from-primary-50/30 to-white p-3.5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        if (modules.length === 0) handleDrop(0, e)
      }}
    >
      {modules.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white/70 py-14 text-center text-sm text-gray-500">
          拖拽左侧组件到这里，或点击组件快速添加
        </div>
      )}

      {modules.map((m, index) => (
        <div
          key={m.id}
          draggable
          onClick={() => onSelect(m.id)}
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-welcome-index', String(index))
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(index, e)}
          className={`cursor-move rounded-xl border px-3 py-2.5 transition ${selectedId === m.id ? 'border-primary-500 bg-primary-50/80 shadow-sm ring-1 ring-primary-200' : 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm'}`}
        >
          <div className="flex items-start gap-2.5">
            <GripVertical size={14} className="mt-0.5 text-gray-400" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{m.type}</p>
              <p className="text-sm text-gray-900 break-all">{moduleTitle(m)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
