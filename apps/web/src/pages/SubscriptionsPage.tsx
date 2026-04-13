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
import api from '../lib/api';

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTenant, setSelectedTenant] = useState('');

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.tenants.list().then((r) => r.data.tenants),
  });

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['subscriptions', selectedTenant],
    queryFn: () =>
      api.subscriptions.list(selectedTenant).then((r) => r.data.subscriptions),
    enabled: !!selectedTenant,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) =>
      api.subscriptions.toggle(selectedTenant, pluginId, enabled),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] }),
  });

  const unsubMutation = useMutation({
    mutationFn: (pluginId: string) =>
      api.subscriptions.unsubscribe(selectedTenant, pluginId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['subscriptions', selectedTenant] }),
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            \u6D3B\u8DC3
          </span>
        );
      case 'expired':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            \u5DF2\u8FC7\u671F
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
        <h2 className="text-2xl font-bold text-gray-900">\u6211\u7684\u8BA2\u9605</h2>
        <p className="text-gray-500 text-sm mt-1">\u7BA1\u7406\u5DF2\u8BA2\u9605\u7684\u63D2\u4EF6</p>
      </div>

      {/* Tenant selector */}
      <div className="card max-w-md">
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

      {selectedTenant && isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-primary-600" size={24} />
        </div>
      )}

      {selectedTenant && !isLoading && (!subscriptions || subscriptions.length === 0) && (
        <div className="card text-center py-12 text-gray-500">
          <p>\u8FD8\u6CA1\u6709\u8BA2\u9605\u4EFB\u4F55\u63D2\u4EF6</p>
          <button
            className="btn-primary mt-4"
            onClick={() => navigate('/plugins')}
          >
            \u6D4F\u89C8\u63D2\u4EF6\u5546\u5E97
          </button>
        </div>
      )}

      {selectedTenant && subscriptions && subscriptions.length > 0 && (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{sub.plugin_name}</h3>
                    {statusBadge(sub.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="capitalize">\u65B9\u6848: {sub.plan_type}</span>
                    {sub.expires_at && (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        \u5230\u671F: {new Date(sub.expires_at).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  {/* Toggle */}
                  <button
                    onClick={() =>
                      toggleMutation.mutate({
                        pluginId: sub.plugin_id,
                        enabled: !sub.enabled,
                      })
                    }
                    disabled={toggleMutation.isPending}
                    className="text-primary-600 hover:text-primary-700"
                    title={sub.enabled ? '\u7981\u7528' : '\u542F\u7528'}
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
                      navigate(`/plugins/${sub.plugin_id}/config`, {
                        state: { tenantId: selectedTenant },
                      })
                    }
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    title="\u914D\u7F6E"
                  >
                    <Settings size={16} />
                  </button>

                  {/* Unsubscribe */}
                  <button
                    onClick={() => {
                      if (confirm('\u786E\u8BA4\u8981\u53D6\u6D88\u8BA2\u9605\u5417\uFF1F')) {
                        unsubMutation.mutate(sub.plugin_id);
                      }
                    }}
                    disabled={unsubMutation.isPending}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                    title="\u53D6\u6D88\u8BA2\u9605"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
