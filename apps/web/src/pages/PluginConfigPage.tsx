import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, ToggleLeft, ToggleRight, RefreshCw, Clock, ExternalLink } from 'lucide-react';
import api, { type Plugin, type Subscription } from '../lib/api';
import { WelcomeCardEditor } from '../components/welcome-card/WelcomeCardEditor';

export default function PluginConfigPage() {
  const { id: pluginId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const statePlugin = (location.state as { plugin?: Plugin; tenantId?: string })?.plugin;
  const stateTenantId = (location.state as { tenantId?: string })?.tenantId;

  const [selectedTenant, setSelectedTenant] = useState(stateTenantId || '');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [enabled, setEnabled] = useState(true);
  const [planType, setPlanType] = useState('monthly');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [runtimeHint, setRuntimeHint] = useState<string | null>(null);

  const { data: plugin } = useQuery({
    queryKey: ['plugin', pluginId],
    queryFn: () => api.plugins.get(pluginId!).then((r) => r.data),
    enabled: !!pluginId && !statePlugin,
    initialData: statePlugin,
  });

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.tenants.list().then((r) => r.data),
  });

  // Auto-select when user has only one bot
  useEffect(() => {
    if (!selectedTenant && tenants?.length === 1) {
      setSelectedTenant(tenants[0].id);
    }
  }, [tenants, selectedTenant]);

  const { data: subscriptions } = useQuery({
    queryKey: ['subscriptions', selectedTenant],
    queryFn: () =>
      api.subscriptions.list(selectedTenant).then((r) => r.data),
    enabled: !!selectedTenant,
  });

  const existingSub = subscriptions?.find((s: Subscription) => s.pluginId === pluginId);
  const isWelcomePlugin = pluginId === 'welcome';
  const pluginTier = plugin?.tier;
  const isPaidPlugin = pluginTier === 'paid';
  const canEditConfig = !!existingSub && existingSub.status === 'active';

  useEffect(() => {
    if (pluginTier === 'paid' && planType === 'lifetime') {
      setPlanType('monthly');
    }
    if (pluginTier === 'free' && planType !== 'lifetime') {
      setPlanType('lifetime');
    }
  }, [pluginTier, planType]);

  const subscribeMutation = useMutation({
    mutationFn: () => api.subscriptions.subscribe(selectedTenant, pluginId!, planType),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] });
      setRuntimeHint(null);
      const data = res.data as any;
      if (data?.paymentRequired) {
        if (data?.riskDecision === 'review') {
          setMessage({ type: 'success', text: `订单已创建并进入人工复核：${data?.riskReason || '请等待管理员审核'}` });
        } else {
          setMessage({ type: 'success', text: '订单已创建，等待管理员确认支付后激活' });
        }
      } else {
        setMessage({ type: 'success', text: '订阅成功' });
      }
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (err: any) => {
      const detail = err?.code ? `${err.code}: ${err.message || '订阅失败'}` : (err?.message || '订阅失败');
      setMessage({ type: 'error', text: detail });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (newEnabled: boolean) =>
      api.subscriptions.toggle(selectedTenant, pluginId!, newEnabled),
    onSuccess: (res, newEnabled) => {
      setEnabled(newEnabled);
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] });
      const runtime = (res.data || {}) as { applied?: 'restarted' | 'queued' | 'noop'; applyError?: string };
      if (runtime.applied === 'restarted') {
        setRuntimeHint('配置已立即生效（实例已自动重启）');
      } else if (runtime.applied === 'queued') {
        setRuntimeHint(runtime.applyError ? `已记录生效请求：${runtime.applyError}` : '实例状态处理中，变更将在运行状态稳定后生效');
      } else {
        setRuntimeHint('实例当前未运行，变更将在下次启动后生效');
      }
      setMessage({ type: 'success', text: newEnabled ? '已启用' : '已禁用' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: any) => {
      const detail = err?.code ? `${err.code}: ${err.message || '操作失败'}` : (err?.message || '操作失败');
      setMessage({ type: 'error', text: detail });
    },
  });

  const configMutation = useMutation({
    mutationFn: () => api.subscriptions.updateConfig(selectedTenant, pluginId!, config),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] });
      const runtime = (res.data || {}) as { applied?: 'restarted' | 'queued' | 'noop'; applyError?: string };
      if (runtime.applied === 'restarted') {
        setRuntimeHint('配置已立即生效（实例已自动重启）');
      } else if (runtime.applied === 'queued') {
        setRuntimeHint(runtime.applyError ? `已记录生效请求：${runtime.applyError}` : '实例状态处理中，配置将在运行状态稳定后生效');
      } else {
        setRuntimeHint('实例当前未运行，配置将在下次启动后生效');
      }
      setMessage({ type: 'success', text: '配置已保存' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: any) => {
      const detail = err?.code ? `${err.code}: ${err.message || '保存失败'}` : (err?.message || '保存失败');
      setMessage({ type: 'error', text: detail });
    },
  });

  const rawSchema = (plugin as any)?.config_schema || (plugin as any)?.configSchema;
  const schemaProperties = useMemo(() => {
    const parsed = typeof rawSchema === 'string'
      ? (() => { try { return JSON.parse(rawSchema); } catch { return {}; } })()
      : (rawSchema || {});
    return (parsed as { properties?: Record<string, ConfigField> }).properties;
  }, [rawSchema]);

  const formEntries = useMemo(() => {
    if (!schemaProperties) return [] as Array<[string, ConfigField]>;
    const entries = Object.entries(schemaProperties) as Array<[string, ConfigField]>;
    if (!isWelcomePlugin) return entries;
    return entries.filter(([key]) => key !== 'card_content' && key !== 'message_type');
  }, [schemaProperties, isWelcomePlugin]);

  useEffect(() => {
    if (existingSub) {
      // Merge schema defaults with saved config so unsaved fields have defaults
      const defaults: Record<string, unknown> = {};
      if (schemaProperties) {
        for (const [key, field] of Object.entries(schemaProperties)) {
          if (field.default !== undefined) defaults[key] = field.default;
        }
      }
      setConfig({ ...defaults, ...(existingSub.config || {}) });
      setEnabled(existingSub.enabled);
    }
  }, [existingSub, schemaProperties]);

  const handleWelcomeCardChange = (cardContent: string, mode: 'card' | 'kmarkdown') => {
    setConfig((prev) => ({
      ...prev,
      card_content: cardContent,
      message_type: mode,
    }));
  };

  return (
    <div className={`space-y-6 ${isWelcomePlugin ? 'max-w-6xl' : 'max-w-2xl'}`}>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">{plugin?.name || '插件配置'}</h2>
        <p className="text-gray-500 text-sm mt-1">{plugin?.description}</p>
      </div>

      {/* Plugin info */}
      {plugin && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-500">版本: v{plugin.version}</span>
              {plugin.category && (
                <span className="ml-3 text-sm text-gray-500">分类: {plugin.category}</span>
              )}
            </div>
            <span className="text-sm font-medium">
              {!plugin.priceMonthly ? '免费' : `¥${(plugin.priceMonthly / 100).toFixed(0)}/月`}
            </span>
          </div>
        </div>
      )}

      {/* Tenant selector */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">选择 Bot 实例</label>
        <select
          className="input-field"
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
        >
          <option value="">请选择</option>
          {tenants?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {selectedTenant && (
        <>
          {message && (
            <div
              className={`text-sm p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {message.text}
            </div>
          )}

          {existingSub && existingSub.status === 'pending' ? (
            /* Pending payment */
            <div className="card border-amber-200 bg-amber-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock size={20} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-800">等待支付确认</h3>
                  <p className="text-sm text-amber-600 mt-0.5">
                    订单已创建，请等待管理员确认支付后自动激活插件
                  </p>
                </div>
              </div>
            </div>
          ) : !existingSub ? (
            /* Subscribe */
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">订阅插件</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">订阅方案</label>
                <select
                  className="input-field"
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value)}
                >
                  {isPaidPlugin ? (
                    <>
                      <option value="monthly">月付</option>
                      <option value="yearly">年付</option>
                    </>
                  ) : (
                    <option value="lifetime">永久</option>
                  )}
                </select>
              </div>
              <button
                className="btn-primary"
                onClick={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
              >
                {subscribeMutation.isPending ? '订阅中...' : '确认订阅'}
              </button>
            </div>
          ) : (
            <>
              {/* Toggle */}
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">插件状态</h3>
                    <p className="text-sm text-gray-500">
                      {enabled ? '已启用' : '已禁用'}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleMutation.mutate(!enabled)}
                    disabled={toggleMutation.isPending}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    {enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-gray-400" />}
                  </button>
                </div>
              </div>

              {existingSub?.status === 'active' && (
                <div className="card flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">插件业务操作</h3>
                    <p className="text-sm text-gray-500">进入 runtime 业务页完成创建/关键动作/异常验证</p>
                  </div>
                  <button
                    className="btn-secondary inline-flex items-center gap-2"
                    onClick={() => navigate(`/plugins/${pluginId}/runtime`, { state: { tenantId: selectedTenant } })}
                  >
                    <ExternalLink size={16} />
                    进入业务页
                  </button>
                </div>
              )}

              {runtimeHint && (
                <div className="card border-primary-200 bg-primary-50 text-sm text-primary-700">
                  {runtimeHint}
                </div>
              )}

              {!canEditConfig && (
                <div className="card border-amber-200 bg-amber-50 text-sm text-amber-700">
                  当前订阅未激活，暂不支持保存配置。
                </div>
              )}

              {/* Config form */}
              {(isWelcomePlugin || (schemaProperties && Object.keys(schemaProperties).length > 0)) && (
                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">插件配置</h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      configMutation.mutate();
                    }}
                    className="space-y-4"
                  >
                    {isWelcomePlugin && (
                      <WelcomeCardEditor
                        value={String(config.card_content || '')}
                        messageType={String(config.message_type || 'kmarkdown')}
                        onChange={handleWelcomeCardChange}
                      />
                    )}

                    {formEntries.map(([key, field]) => (
                      <ConfigFormField
                        key={key}
                        name={key}
                        field={field}
                        value={config[key]}
                        onChange={(val) => setConfig((prev) => ({ ...prev, [key]: val }))}
                      />
                    ))}

                    <button
                      type="submit"
                      className="btn-primary flex items-center gap-2"
                      disabled={configMutation.isPending || !canEditConfig}
                    >
                      <Save size={16} />
                      {configMutation.isPending ? '保存中...' : '保存配置'}
                    </button>
                  </form>
                </div>
              )}

              {!isWelcomePlugin && (!schemaProperties || Object.keys(schemaProperties).length === 0) && (
                <div className="card text-center py-8 text-gray-500">
                  <RefreshCw className="mx-auto mb-2 text-gray-300" size={24} />
                  <p>此插件无额外配置项</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

interface ConfigField {
  type: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
}

function ConfigFormField({
  name,
  field,
  value,
  onChange,
}: {
  name: string;
  field: ConfigField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const label = field.title || name;
  const currentValue = value ?? field.default ?? '';

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700">{label}</label>
          {field.description && (
            <p className="text-xs text-gray-400">{field.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(!currentValue)}
          className="text-primary-600"
        >
          {currentValue ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-gray-400" />}
        </button>
      </div>
    );
  }

  if (field.enum) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {field.description && (
          <p className="text-xs text-gray-400 mb-1">{field.description}</p>
        )}
        <select
          className="input-field"
          value={String(currentValue)}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'number' || field.type === 'integer') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {field.description && (
          <p className="text-xs text-gray-400 mb-1">{field.description}</p>
        )}
        <input
          type="number"
          className="input-field"
          value={String(currentValue)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    );
  }

  // Multi-line string fields (description mentions "每行")
  const isMultiline = field.description?.includes('每行');

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {field.description && (
        <p className="text-xs text-gray-400 mb-1">{field.description}</p>
      )}
      {isMultiline ? (
        <textarea
          className="input-field min-h-[100px] font-mono text-sm"
          value={String(currentValue)}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
        />
      ) : (
        <input
          type="text"
          className="input-field"
          value={String(currentValue)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
