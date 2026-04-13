import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import api, { type Plugin } from '../lib/api';

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
    queryFn: () => api.plugins.get(pluginId!).then((r) => r.data.plugin),
    enabled: !!pluginId && !statePlugin,
    initialData: statePlugin,
  });

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.tenants.list().then((r) => r.data.tenants),
  });

  const { data: subscriptions } = useQuery({
    queryKey: ['subscriptions', selectedTenant],
    queryFn: () =>
      api.subscriptions.list(selectedTenant).then((r) => r.data.subscriptions),
    enabled: !!selectedTenant,
  });

  const existingSub = subscriptions?.find((s) => s.plugin_id === pluginId);

  useEffect(() => {
    if (existingSub) {
      setConfig(existingSub.config || {});
      setEnabled(existingSub.enabled);
    }
  }, [existingSub]);

  const subscribeMutation = useMutation({
    mutationFn: () => api.subscriptions.subscribe(selectedTenant, pluginId!, planType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] });
      setMessage({ type: 'success', text: '\u8BA2\u9605\u6210\u529F' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '\u8BA2\u9605\u5931\u8D25' }),
  });

  const toggleMutation = useMutation({
    mutationFn: (newEnabled: boolean) =>
      api.subscriptions.toggle(selectedTenant, pluginId!, newEnabled),
    onSuccess: (_, newEnabled) => {
      setEnabled(newEnabled);
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] });
      setMessage({ type: 'success', text: newEnabled ? '\u5DF2\u542F\u7528' : '\u5DF2\u7981\u7528' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '\u64CD\u4F5C\u5931\u8D25' }),
  });

  const configMutation = useMutation({
    mutationFn: () => api.subscriptions.updateConfig(selectedTenant, pluginId!, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] });
      setMessage({ type: 'success', text: '\u914D\u7F6E\u5DF2\u4FDD\u5B58' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '\u4FDD\u5B58\u5931\u8D25' }),
  });

  const configSchema = plugin?.config_schema || {};
  const schemaProperties = (configSchema as { properties?: Record<string, ConfigField> })
    .properties;

  return (
    <div className="space-y-6 max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> \u8FD4\u56DE
      </button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">{plugin?.name || '\u63D2\u4EF6\u914D\u7F6E'}</h2>
        <p className="text-gray-500 text-sm mt-1">{plugin?.description}</p>
      </div>

      {/* Plugin info */}
      {plugin && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-500">\u7248\u672C: v{plugin.version}</span>
              {plugin.category && (
                <span className="ml-3 text-sm text-gray-500">\u5206\u7C7B: {plugin.category}</span>
              )}
            </div>
            <span className="text-sm font-medium">
              {plugin.price_monthly === 0 ? '\u514D\u8D39' : `\u00A5${plugin.price_monthly}/\u6708`}
            </span>
          </div>
        </div>
      )}

      {/* Tenant selector */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">\u9009\u62E9 Bot \u5B9E\u4F8B</label>
        <select
          className="input-field"
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
        >
          <option value="">\u8BF7\u9009\u62E9</option>
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

          {!existingSub ? (
            /* Subscribe */
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">\u8BA2\u9605\u63D2\u4EF6</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">\u8BA2\u9605\u65B9\u6848</label>
                <select
                  className="input-field"
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value)}
                >
                  <option value="monthly">\u6708\u4ED8</option>
                  <option value="yearly">\u5E74\u4ED8</option>
                  <option value="free">\u514D\u8D39</option>
                </select>
              </div>
              <button
                className="btn-primary"
                onClick={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
              >
                {subscribeMutation.isPending ? '\u8BA2\u9605\u4E2D...' : '\u786E\u8BA4\u8BA2\u9605'}
              </button>
            </div>
          ) : (
            <>
              {/* Toggle */}
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">\u63D2\u4EF6\u72B6\u6001</h3>
                    <p className="text-sm text-gray-500">
                      {enabled ? '\u5DF2\u542F\u7528' : '\u5DF2\u7981\u7528'}
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
                  <h3 className="text-lg font-semibold mb-4">\u63D2\u4EF6\u914D\u7F6E</h3>
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
                      {configMutation.isPending ? '\u4FDD\u5B58\u4E2D...' : '\u4FDD\u5B58\u914D\u7F6E'}
                    </button>
                  </form>
                </div>
              )}

              {(!schemaProperties || Object.keys(schemaProperties).length === 0) && (
                <div className="card text-center py-8 text-gray-500">
                  <RefreshCw className="mx-auto mb-2 text-gray-300" size={24} />
                  <p>\u6B64\u63D2\u4EF6\u65E0\u989D\u5916\u914D\u7F6E\u9879</p>
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
