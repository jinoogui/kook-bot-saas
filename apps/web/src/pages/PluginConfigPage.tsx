import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, ToggleLeft, ToggleRight, RefreshCw, Clock } from 'lucide-react';
import api, { type Plugin, type Subscription } from '../lib/api';

export default function PluginConfigPage() {
  const { id: pluginId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const statePlugin = (location.state as { plugin?: Plugin })?.plugin;

  const [selectedTenant, setSelectedTenant] = useState('');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [enabled, setEnabled] = useState(true);
  const [planType, setPlanType] = useState('monthly');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  useEffect(() => {
    if (existingSub) {
      setConfig(existingSub.config || {});
      setEnabled(existingSub.enabled);
    }
  }, [existingSub]);

  const subscribeMutation = useMutation({
    mutationFn: () => api.subscriptions.subscribe(selectedTenant, pluginId!, planType),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] });
      const data = res.data as any;
      if (data?.paymentRequired) {
        setMessage({ type: 'success', text: '订单已创建，等待管理员确认支付后激活' });
      } else {
        setMessage({ type: 'success', text: '订阅成功' });
      }
      setTimeout(() => setMessage(null), 5000);
    },
    onError: () => setMessage({ type: 'error', text: '订阅失败' }),
  });

  const toggleMutation = useMutation({
    mutationFn: (newEnabled: boolean) =>
      api.subscriptions.toggle(selectedTenant, pluginId!, newEnabled),
    onSuccess: (_, newEnabled) => {
      setEnabled(newEnabled);
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] });
      setMessage({ type: 'success', text: newEnabled ? '已启用' : '已禁用' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '操作失败' }),
  });

  const configMutation = useMutation({
    mutationFn: () => api.subscriptions.updateConfig(selectedTenant, pluginId!, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] });
      setMessage({ type: 'success', text: '配置已保存' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '保存失败' }),
  });

  const rawSchema = (plugin as any)?.config_schema || (plugin as any)?.configSchema;
  const configSchema = typeof rawSchema === 'string' ? (() => { try { return JSON.parse(rawSchema); } catch { return {}; } })() : (rawSchema || {});
  const schemaProperties = (configSchema as { properties?: Record<string, ConfigField> })
    .properties;

  return (
    <div className="space-y-6 max-w-2xl">
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
                  <option value="monthly">月付</option>
                  <option value="yearly">年付</option>
                  <option value="free">免费</option>
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

              {/* Config form */}
              {schemaProperties && Object.keys(schemaProperties).length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">插件配置</h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      configMutation.mutate();
                    }}
                    className="space-y-4"
                  >
                    {Object.entries(schemaProperties).map(([key, field]) => (
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
                      disabled={configMutation.isPending}
                    >
                      <Save size={16} />
                      {configMutation.isPending ? '保存中...' : '保存配置'}
                    </button>
                  </form>
                </div>
              )}

              {(!schemaProperties || Object.keys(schemaProperties).length === 0) && (
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

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {field.description && (
        <p className="text-xs text-gray-400 mb-1">{field.description}</p>
      )}
      <input
        type="text"
        className="input-field"
        value={String(currentValue)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
