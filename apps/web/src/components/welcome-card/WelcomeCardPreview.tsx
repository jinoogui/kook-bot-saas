import type { WelcomeCardModel, WelcomeCardModule } from './welcomeCardModel'

interface Props {
  model: WelcomeCardModel
}

function renderModule(module: WelcomeCardModule, index: number) {
  switch (module.type) {
    case 'header':
      return <h4 key={module.id} className="text-base font-semibold text-gray-900">{module.content || '标题'}</h4>
    case 'section':
      return <p key={module.id} className="text-sm text-gray-700 whitespace-pre-wrap">{module.content || '正文'}</p>
    case 'image':
      return (
        <div key={module.id} className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
          {module.src ? <img src={module.src} alt="preview" className="h-32 w-full object-cover" /> : <div className="h-32" />}
        </div>
      )
    case 'divider':
      return <hr key={module.id} className="border-gray-200" />
    case 'button':
      return (
        <button
          key={module.id}
          type="button"
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white"
        >
          {module.label || '按钮'}
        </button>
      )
    case 'context':
      return <p key={module.id} className="text-xs text-gray-500">{module.content || '上下文'}</p>
    default:
      return <div key={index} />
  }
}

export function WelcomeCardPreview({ model }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-gray-500">实时预览</p>
        <p className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">theme: {model.theme}</p>
      </div>
      <div className="space-y-3 rounded-xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white p-3.5">
        {model.modules.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">暂无模块，先从左侧添加</p>
        ) : (
          model.modules.map((m, i) => renderModule(m, i))
        )}
      </div>
    </div>
  )
}
