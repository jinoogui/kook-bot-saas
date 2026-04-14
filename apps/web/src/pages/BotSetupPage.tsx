import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Play, Square, RotateCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api, { type Tenant } from '../lib/api';

export default function BotSetupPage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const tenantId = (location.state as { tenantId?: string })?.tenantId;

  const [selectedTenant, setSelectedTenant] = useState<string>(tenantId || '');
  const [name, setName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [initialized, setInitialized] = useState(false);

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

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant', selectedTenant],
    queryFn: () => api.tenants.get(selectedTenant).then((r) => r.data),
    enabled: !!selectedTenant,
  });

  useEffect(() => {
    if (tenant && !initialized) {
      setName(tenant.name || '');
      // Don't overwrite bot token from API response (it's not returned for security)
      setInitialized(true);
    }
  }, [tenant, initialized]);

  // When tenant selection changes, reset form
  useEffect(() => {
    setInitialized(false);
    setBotToken('');
  }, [selectedTenant]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.tenants.update(selectedTenant, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', selectedTenant] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setMessage({ type: 'success', text: '保存成功' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '保存失败' }),
  });

  const startMutation = useMutation({
    mutationFn: () => api.instances.start(selectedTenant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', selectedTenant] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setMessage({ type: 'success', text: 'Bot 已启动' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '启动失败' }),
  });

  const stopMutation = useMutation({
    mutationFn: () => api.instances.stop(selectedTenant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', selectedTenant] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setMessage({ type: 'success', text: 'Bot 已停止' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '停止失败' }),
  });

  const restartMutation = useMutation({
    mutationFn: () => api.instances.restart(selectedTenant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', selectedTenant] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setMessage({ type: 'success', text: 'Bot 已重启' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '重启失败' }),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = { name };
    if (botToken) data.botToken = botToken;
    updateMutation.mutate(data);
  };

  const statusBadge = (status?: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <CheckCircle size={14} /> 运行中
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
            <XCircle size={14} /> 已停止
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <AlertCircle size={14} /> 错误
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Bot 设置</h2>
        <p className="text-gray-500 text-sm mt-1">配置和管理你的 Bot 实例</p>
      </div>

      {/* Tenant selector */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">选择 Bot</label>
        <select
          className="input-field"
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
        >
          <option value="">请选择一个 Bot</option>
          {tenants?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {selectedTenant && tenantLoading && (
        <div className="card text-center py-8 text-gray-500">加载中...</div>
      )}

      {selectedTenant && tenant && (
        <>
          {/* Status + Actions */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">实例状态</h3>
              {statusBadge(tenant.status)}
            </div>
            <div className="flex gap-2">
              <button
                className="btn-primary flex items-center gap-1.5 text-sm"
                onClick={() => startMutation.mutate()}
                disabled={tenant.status === 'running' || startMutation.isPending}
              >
                <Play size={14} /> 启动
              </button>
              <button
                className="btn-secondary flex items-center gap-1.5 text-sm"
                onClick={() => stopMutation.mutate()}
                disabled={tenant.status === 'stopped' || stopMutation.isPending}
              >
                <Square size={14} /> 停止
              </button>
              <button
                className="btn-secondary flex items-center gap-1.5 text-sm"
                onClick={() => restartMutation.mutate()}
                disabled={tenant.status !== 'running' || restartMutation.isPending}
              >
                <RotateCw size={14} /> 重启
              </button>
            </div>
          </div>

          {/* Config form */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Bot 配置</h3>

            {message && (
              <div
                className={`text-sm p-3 rounded-lg mb-4 ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bot 名称</label>
                <input
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bot Token
                  {tenant.hasToken && !botToken && (
                    <span className="ml-2 text-xs text-green-600 font-normal">已配置</span>
                  )}
                </label>
                <input
                  className="input-field font-mono text-sm"
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder={tenant.hasToken ? '留空则保持原 Token 不变' : '请输入 Bot Token'}
                />
              </div>

              <button
                type="submit"
                className="btn-primary flex items-center gap-2"
                disabled={updateMutation.isPending}
              >
                <Save size={16} />
                {updateMutation.isPending ? '保存中...' : '保存配置'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
