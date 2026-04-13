import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Square, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import api, { type Tenant } from '../lib/api';

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newToken, setNewToken] = useState('');
  const [createError, setCreateError] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.tenants.list().then((r) => r.data.tenants),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; bot_token: string }) => api.tenants.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setShowCreate(false);
      setNewName('');
      setNewToken('');
      setCreateError('');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '\u521B\u5EFA\u5931\u8D25';
      setCreateError(msg);
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => api.instances.start(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => api.instances.stop(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const statusBadge = (status: Tenant['status']) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle size={12} /> \u8FD0\u884C\u4E2D
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <XCircle size={12} /> \u5DF2\u505C\u6B62
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertCircle size={12} /> \u9519\u8BEF
          </span>
        );
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name: newName, bot_token: newToken });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="animate-spin text-primary-600" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center text-red-600">
        <AlertCircle className="mx-auto mb-2" size={32} />
        <p>\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u91CD\u8BD5</p>
      </div>
    );
  }

  const tenants = data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">\u7BA1\u7406\u4F60\u7684 Kook Bot \u5B9E\u4F8B</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={18} /> \u521B\u5EFA\u65B0 Bot
        </button>
      </div>

      {/* Create form modal */}
      {showCreate && (
        <div className="card border-primary-200">
          <h3 className="text-lg font-semibold mb-4">\u521B\u5EFA\u65B0 Bot</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{createError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bot \u540D\u79F0</label>
              <input
                className="input-field"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="\u4F8B\u5982\uFF1AMy Kook Bot"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bot Token</label>
              <input
                className="input-field"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="\u4ECE Kook \u5F00\u53D1\u8005\u5E73\u53F0\u83B7\u53D6"
                required
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? '\u521B\u5EFA\u4E2D...' : '\u521B\u5EFA'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                \u53D6\u6D88
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tenants list */}
      {tenants.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <Bot className="mx-auto mb-3 text-gray-300" size={48} />
          <p>\u8FD8\u6CA1\u6709\u521B\u5EFA Bot\uFF0C\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u5F00\u59CB\u521B\u5EFA</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <div key={tenant.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
                {statusBadge(tenant.status)}
              </div>

              <p className="text-xs text-gray-400 mb-4">
                \u521B\u5EFA\u4E8E {new Date(tenant.created_at).toLocaleDateString('zh-CN')}
              </p>

              <div className="flex gap-2">
                {tenant.status === 'running' ? (
                  <button
                    className="btn-secondary text-sm flex items-center gap-1"
                    onClick={() => stopMutation.mutate(tenant.id)}
                    disabled={stopMutation.isPending}
                  >
                    <Square size={14} /> \u505C\u6B62
                  </button>
                ) : (
                  <button
                    className="btn-primary text-sm flex items-center gap-1"
                    onClick={() => startMutation.mutate(tenant.id)}
                    disabled={startMutation.isPending}
                  >
                    <Play size={14} /> \u542F\u52A8
                  </button>
                )}
                <button
                  className="btn-secondary text-sm"
                  onClick={() => navigate('/bot-setup', { state: { tenantId: tenant.id } })}
                >
                  \u8BBE\u7F6E
                </button>
                <button
                  className="btn-secondary text-sm"
                  onClick={() => navigate('/monitoring', { state: { tenantId: tenant.id } })}
                >
                  \u76D1\u63A7
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Bot(props: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size || 24}
      height={props.size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}
