import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ToggleLeft,
  ToggleRight,
  Settings,
  Trash2,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import api, { type Subscription } from '../lib/api';

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTenant, setSelectedTenant] = useState('');
  const [mutError, setMutError] = useState('');

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.tenants.list().then((r) => r.data),
  });

  const { data: subscriptions, isLoading, error } = useQuery({
    queryKey: ['subscriptions', selectedTenant],
    queryFn: () =>
      api.subscriptions.list(selectedTenant).then((r) => r.data),
    enabled: !!selectedTenant,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) =>
      api.subscriptions.toggle(selectedTenant, pluginId, enabled),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] }),
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.error || '操作失败';
      setMutError(msg);
      setTimeout(() => setMutError(''), 3000);
    },
  });

  const unsubMutation = useMutation({
    mutationFn: (pluginId: string) =>
      api.subscriptions.unsubscribe(selectedTenant, pluginId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] }),
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.error || '操作失败';
      setMutError(msg);
      setTimeout(() => setMutError(''), 3000);
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            活跃
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            待支付
          </span>
        );
      case 'expired':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            已过期
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">我的订阅</h2>
        <p className="text-gray-500 text-sm mt-1">管理已订阅的插件</p>
      </div>

      {/* Tenant selector */}
      <div className="card max-w-md">
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

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">加载订阅列表失败</div>
      )}
      {mutError && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{mutError}</div>
      )}

      {selectedTenant && isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-primary-600" size={24} />
        </div>
      )}

      {selectedTenant && !isLoading && (!subscriptions || subscriptions.length === 0) && (
        <div className="card text-center py-12 text-gray-500">
          <p>还没有订阅任何插件</p>
          <button
            className="btn-primary mt-4"
            onClick={() => navigate('/plugins')}
          >
            浏览插件商店
          </button>
        </div>
      )}

      {selectedTenant && subscriptions && subscriptions.length > 0 && (
        <div className="space-y-3">
          {subscriptions.map((sub: Subscription) => (
            <div key={sub.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{sub.pluginName}</h3>
                    {statusBadge(sub.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="capitalize">方案: {sub.planType}</span>
                    {sub.expiresAt && (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        到期: {new Date(sub.expiresAt).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  {sub.status === 'pending' ? (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                      等待管理员确认支付
                    </span>
                  ) : (
                    <>
                      {/* Toggle */}
                      <button
                        onClick={() =>
                          toggleMutation.mutate({
                            pluginId: sub.pluginId,
                            enabled: !sub.enabled,
                          })
                        }
                        disabled={toggleMutation.isPending}
                        className="text-primary-600 hover:text-primary-700"
                        title={sub.enabled ? '禁用' : '启用'}
                      >
                        {sub.enabled ? (
                          <ToggleRight size={28} />
                        ) : (
                          <ToggleLeft size={28} className="text-gray-400" />
                        )}
                      </button>

                      {/* Config */}
                      <button
                        onClick={() =>
                          navigate(`/plugins/${sub.pluginId}/config`, {
                            state: { tenantId: selectedTenant },
                          })
                        }
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        title="配置"
                      >
                        <Settings size={16} />
                      </button>

                      {/* Unsubscribe */}
                      <button
                        onClick={() => {
                          if (confirm('确认要取消订阅吗？')) {
                            unsubMutation.mutate(sub.pluginId);
                          }
                        }}
                        disabled={unsubMutation.isPending}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        title="取消订阅"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
