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
  const [actionError, setActionError] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.tenants.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; botToken: string }) => api.tenants.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setShowCreate(false);
      setNewName('');
      setNewToken('');
      setCreateError('');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        '创建失败';
      setCreateError(msg);
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => api.instances.start(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.error || '启动失败';
      setActionError(msg);
      setTimeout(() => setActionError(''), 3000);
    },
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => api.instances.stop(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.error || '停止失败';
      setActionError(msg);
      setTimeout(() => setActionError(''), 3000);
    },
  });

  const statusBadge = (status: Tenant['status']) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle size={12} /> 运行中
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <XCircle size={12} /> 已停止
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertCircle size={12} /> 错误
          </span>
        );
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name: newName, botToken: newToken });
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
        <p>加载失败，请刷新页面重试</p>
      </div>
    );
  }

  const tenants = data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">管理你的 Kook Bot 实例</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={18} /> 创建新 Bot
        </button>
      </div>

      {/* Create form modal */}
      {showCreate && (
        <div className="card border-primary-200">
          <h3 className="text-lg font-semibold mb-4">创建新 Bot</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{createError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bot 名称</label>
              <input
                className="input-field"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如：My Kook Bot"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bot Token</label>
              <input
                className="input-field"
                type="password"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="从 Kook 开发者平台获取"
                required
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? '创建中...' : '创建'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{actionError}</div>
      )}

      {/* Tenants list */}
      {tenants.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <Bot className="mx-auto mb-3 text-gray-300" size={48} />
          <p>还没有创建 Bot，点击上方按钮开始创建</p>
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
                创建于 {new Date(tenant.createdAt).toLocaleDateString('zh-CN')}
              </p>

              <div className="flex gap-2">
                {tenant.status === 'running' ? (
                  <button
                    className="btn-secondary text-sm flex items-center gap-1"
                    onClick={() => stopMutation.mutate(tenant.id)}
                    disabled={stopMutation.isPending}
                  >
                    <Square size={14} /> 停止
                  </button>
                ) : (
                  <button
                    className="btn-primary text-sm flex items-center gap-1"
                    onClick={() => startMutation.mutate(tenant.id)}
                    disabled={startMutation.isPending}
                  >
                    <Play size={14} /> 启动
                  </button>
                )}
                <button
                  className="btn-secondary text-sm"
                  onClick={() => navigate('/bot-setup', { state: { tenantId: tenant.id } })}
                >
                  设置
                </button>
                <button
                  className="btn-secondary text-sm"
                  onClick={() => navigate('/monitoring', { state: { tenantId: tenant.id } })}
                >
                  监控
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
