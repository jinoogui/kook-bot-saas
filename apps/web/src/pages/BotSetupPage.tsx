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
  const [verifyToken, setVerifyToken] = useState('');
  const [encryptKey, setEncryptKey] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.tenants.list().then((r) => r.data.tenants),
  });

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant', selectedTenant],
    queryFn: () => api.tenants.get(selectedTenant).then((r) => r.data.tenant),
    enabled: !!selectedTenant,
  });

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setBotToken(tenant.bot_token);
      setVerifyToken(tenant.verify_token || '');
      setEncryptKey(tenant.encrypt_key || '');
    }
  }, [tenant]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Tenant>) => api.tenants.update(selectedTenant, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', selectedTenant] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setMessage({ type: 'success', text: '\u4FDD\u5B58\u6210\u529F' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '\u4FDD\u5B58\u5931\u8D25' }),
  });

  const startMutation = useMutation({
    mutationFn: () => api.instances.start(selectedTenant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', selectedTenant] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setMessage({ type: 'success', text: 'Bot \u5DF2\u542F\u52A8' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '\u542F\u52A8\u5931\u8D25' }),
  });

  const stopMutation = useMutation({
    mutationFn: () => api.instances.stop(selectedTenant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', selectedTenant] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setMessage({ type: 'success', text: 'Bot \u5DF2\u505C\u6B62' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '\u505C\u6B62\u5931\u8D25' }),
  });

  const restartMutation = useMutation({
    mutationFn: () => api.instances.restart(selectedTenant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', selectedTenant] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setMessage({ type: 'success', text: 'Bot \u5DF2\u91CD\u542F' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => setMessage({ type: 'error', text: '\u91CD\u542F\u5931\u8D25' }),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      name,
      bot_token: botToken,
      verify_token: verifyToken || undefined,
      encrypt_key: encryptKey || undefined,
    });
  };

  const statusBadge = (status?: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <CheckCircle size={14} /> \u8FD0\u884C\u4E2D
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
            <XCircle size={14} /> \u5DF2\u505C\u6B62
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <AlertCircle size={14} /> \u9519\u8BEF
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Bot \u8BBE\u7F6E</h2>
        <p className="text-gray-500 text-sm mt-1">\u914D\u7F6E\u548C\u7BA1\u7406\u4F60\u7684 Bot \u5B9E\u4F8B</p>
      </div>

      {/* Tenant selector */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">\u9009\u62E9 Bot</label>
        <select
          className="input-field"
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
        >
          <option value="">\u8BF7\u9009\u62E9\u4E00\u4E2A Bot</option>
          {tenants?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {selectedTenant && tenantLoading && (
        <div className="card text-center py-8 text-gray-500">\u52A0\u8F7D\u4E2D...</div>
      )}

      {selectedTenant && tenant && (
        <>
          {/* Status + Actions */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">\u5B9E\u4F8B\u72B6\u6001</h3>
              {statusBadge(tenant.status)}
            </div>
            <div className="flex gap-2">
              <button
                className="btn-primary flex items-center gap-1.5 text-sm"
                onClick={() => startMutation.mutate()}
                disabled={tenant.status === 'running' || startMutation.isPending}
              >
                <Play size={14} /> \u542F\u52A8
              </button>
              <button
                className="btn-secondary flex items-center gap-1.5 text-sm"
                onClick={() => stopMutation.mutate()}
                disabled={tenant.status === 'stopped' || stopMutation.isPending}
              >
                <Square size={14} /> \u505C\u6B62
              </button>
              <button
                className="btn-secondary flex items-center gap-1.5 text-sm"
                onClick={() => restartMutation.mutate()}
                disabled={tenant.status !== 'running' || restartMutation.isPending}
              >
                <RotateCw size={14} /> \u91CD\u542F
              </button>
            </div>
          </div>

          {/* Config form */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Bot \u914D\u7F6E</h3>

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Bot \u540D\u79F0</label>
                <input
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bot Token</label>
                <input
                  className="input-field font-mono text-sm"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Verify Token <span className="text-gray-400">(\u53EF\u9009)</span>
                </label>
                <input
                  className="input-field font-mono text-sm"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  placeholder="\u7528\u4E8E Webhook \u9A8C\u8BC1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Encrypt Key <span className="text-gray-400">(\u53EF\u9009)</span>
                </label>
                <input
                  className="input-field font-mono text-sm"
                  value={encryptKey}
                  onChange={(e) => setEncryptKey(e.target.value)}
                  placeholder="\u7528\u4E8E\u6D88\u606F\u52A0\u5BC6"
                />
              </div>

              <button
                type="submit"
                className="btn-primary flex items-center gap-2"
                disabled={updateMutation.isPending}
              >
                <Save size={16} />
                {updateMutation.isPending ? '\u4FDD\u5B58\u4E2D...' : '\u4FDD\u5B58\u914D\u7F6E'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
