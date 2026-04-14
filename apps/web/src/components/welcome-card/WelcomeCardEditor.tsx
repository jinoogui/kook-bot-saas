import { Code2, Eye, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { WelcomeCardCanvas } from './WelcomeCardCanvas'
import { WelcomeCardInspector } from './WelcomeCardInspector'
import { WelcomeCardPalette } from './WelcomeCardPalette'
import {
  createModule,
  type WelcomeCardModel,
  type WelcomeCardModule,
  type WelcomeModuleType,
} from './welcomeCardModel'
import { fromKookCardContent, toKookCardContent } from './welcomeCardTransforms'
import { WelcomeCardPreview } from './WelcomeCardPreview'

interface Props {
  value: string
  messageType?: string
  onChange: (cardContent: string, messageType: 'card' | 'kmarkdown') => void
}

export function WelcomeCardEditor({ value, messageType, onChange }: Props) {
  const [model, setModel] = useState<WelcomeCardModel>(() => fromKookCardContent(value))
  const [selectedId, setSelectedId] = useState<string | null>(model.modules[0]?.id ?? null)
  const [jsonMode, setJsonMode] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [cardEnabled, setCardEnabled] = useState(messageType === 'card')

  useEffect(() => {
    const next = fromKookCardContent(value)
    setModel(next)
    if (!selectedId || !next.modules.some((m) => m.id === selectedId)) {
      setSelectedId(next.modules[0]?.id ?? null)
    }
  }, [value])

  useEffect(() => {
    setCardEnabled(messageType === 'card')
  }, [messageType])

  useEffect(() => {
    onChange(toKookCardContent(model), cardEnabled ? 'card' : 'kmarkdown')
  }, [model, cardEnabled])

  const selected = useMemo(
    () => model.modules.find((m) => m.id === selectedId) ?? null,
    [model.modules, selectedId],
  )

  const updateSelected = (patch: Partial<WelcomeCardModule>) => {
    if (!selected) return
    setModel((prev) => ({
      ...prev,
      modules: prev.modules.map((m) => (m.id === selected.id ? { ...m, ...patch } : m)),
    }))
  }

  const addModule = (type: WelcomeModuleType, index?: number) => {
    const next = createModule(type)
    setModel((prev) => {
      const modules = [...prev.modules]
      if (index === undefined || index < 0 || index >= modules.length) modules.push(next)
      else modules.splice(index, 0, next)
      return { ...prev, modules }
    })
    setSelectedId(next.id)
  }

  const moveModule = (from: number, to: number) => {
    setModel((prev) => {
      if (from < 0 || to < 0 || from >= prev.modules.length || to >= prev.modules.length) return prev
      const modules = [...prev.modules]
      const [item] = modules.splice(from, 1)
      modules.splice(to, 0, item)
      return { ...prev, modules }
    })
  }

  const deleteSelected = () => {
    if (!selected) return
    setModel((prev) => {
      const modules = prev.modules.filter((m) => m.id !== selected.id)
      return { ...prev, modules }
    })
    setSelectedId((prev) => (prev === selected.id ? null : prev))
  }

  const enterJsonMode = () => {
    setJsonText(JSON.stringify(JSON.parse(toKookCardContent(model)), null, 2))
    setJsonError(null)
    setJsonMode(true)
  }

  const applyJson = () => {
    try {
      JSON.parse(jsonText)
      const parsed = fromKookCardContent(jsonText)
      setModel(parsed)
      setSelectedId(parsed.modules[0]?.id ?? null)
      setJsonError(null)
      setJsonMode(false)
    } catch (err: any) {
      setJsonError(err?.message || 'JSON 格式错误')
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/50 p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">欢迎卡片可视化编辑器</h3>
          <p className="mt-1 text-xs text-gray-500">拖拽排序、点击编辑、实时预览</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-xs font-medium text-gray-500">卡片模式</label>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${cardEnabled ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            onClick={() => setCardEnabled((v) => !v)}
          >
            {cardEnabled ? '已启用' : '已关闭'}
          </button>
          {!jsonMode ? (
            <button type="button" className="btn-secondary inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs" onClick={enterJsonMode}>
              <Code2 size={14} /> JSON 模式
            </button>
          ) : (
            <button type="button" className="btn-secondary inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs" onClick={() => setJsonMode(false)}>
              <Eye size={14} /> 返回可视化
            </button>
          )}
        </div>
      </div>

      {jsonMode ? (
        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
          <textarea
            className="input-field min-h-[280px] font-mono text-xs"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          {jsonError && <p className="text-xs text-red-600">{jsonError}</p>}
          <div className="flex justify-end">
            <button type="button" className="btn-primary inline-flex items-center gap-1.5 text-sm" onClick={applyJson}>
              <Sparkles size={14} /> 应用 JSON
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[260px_minmax(0,1fr)_340px]">
          <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
            <p className="mb-2 text-xs font-medium tracking-wide text-gray-500">组件库</p>
            <WelcomeCardPalette
              onDragStart={(type, e) => e.dataTransfer.setData('application/x-welcome-module', type)}
              onAdd={addModule}
            />
          </section>

          <section className="min-w-0 space-y-2">
            <p className="text-xs font-medium tracking-wide text-gray-500">画布</p>
            <WelcomeCardCanvas
              modules={model.modules}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={moveModule}
              onDropNew={addModule}
            />
          </section>

          <section className="min-w-0 space-y-3 xl:col-span-2 2xl:col-span-1">
            <WelcomeCardInspector module={selected} onChange={updateSelected} onDelete={deleteSelected} />
            <WelcomeCardPreview model={model} />
          </section>
        </div>
      )}
    </div>
  )
}
