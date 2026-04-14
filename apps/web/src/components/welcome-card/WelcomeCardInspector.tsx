import { Trash2 } from 'lucide-react'
import type { WelcomeCardModule } from './welcomeCardModel'

interface Props {
  module: WelcomeCardModule | null
  onChange: (patch: Partial<WelcomeCardModule>) => void
  onDelete: () => void
}

const THEME_OPTIONS = [
  { value: 'primary', label: 'primary' },
  { value: 'success', label: 'success' },
  { value: 'warning', label: 'warning' },
  { value: 'danger', label: 'danger' },
  { value: 'secondary', label: 'secondary' },
] as const

export function WelcomeCardInspector({ module, onChange, onDelete }: Props) {
  if (!module) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        请选择一个模块进行编辑
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">模块属性</h4>
          <p className="text-xs text-gray-500">当前类型: {module.type}</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          onClick={onDelete}
        >
          <Trash2 size={12} /> 删除
        </button>
      </div>

      {(module.type === 'header' || module.type === 'section' || module.type === 'context') && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">内容</label>
          <textarea
            className="input-field min-h-[100px]"
            value={module.content || ''}
            onChange={(e) => onChange({ content: e.target.value })}
          />
        </div>
      )}

      {module.type === 'image' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">图片 URL</label>
          <input
            className="input-field"
            value={module.src || ''}
            onChange={(e) => onChange({ src: e.target.value })}
            placeholder="https://..."
          />
        </div>
      )}

      {module.type === 'button' && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">按钮文字</label>
            <input
              className="input-field"
              value={module.label || ''}
              onChange={(e) => onChange({ label: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">链接 URL</label>
            <input
              className="input-field"
              value={module.url || ''}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">按钮主题</label>
            <select
              className="input-field"
              value={module.theme || 'primary'}
              onChange={(e) => onChange({ theme: e.target.value as WelcomeCardModule['theme'] })}
            >
              {THEME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  )
}
