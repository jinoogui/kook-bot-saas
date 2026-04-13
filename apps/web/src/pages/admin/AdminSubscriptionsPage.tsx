import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, X as XIcon } from 'lucide-react';
import api from '../../lib/api';

type Tab = 'subscriptions' | 'payments';

export default function AdminSubscriptionsPage() {
  const [tab, setTab] = useState<Tab>('subscriptions');
  const queryClient = useQueryClient();

  const { data: subsData, isLoading: subsLoading, error: subsError } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: () => api.admin.getSubscriptions(),
  });

  const { data: payData, isLoading: payLoading, error: payError } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => api.admin.getPayments(),
  });

  const subs = (subsData?.data as any[]) ?? [];
  const pays = (payData?.data as any[]) ?? [];

  const confirmMutation = useMutation({
    mutationFn: (id: number) => api.admin.confirmPayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => api.admin.rejectPayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
  });

  const statusCfg: Record<string, { text: string; cls: string }> = {
    active: { text: '有效', cls: 'bg-green-50 text-green-700' },
    pending: { text: '待确认', cls: 'bg-amber-50 text-amber-700' },
    expired: { text: '已过期', cls: 'bg-gray-100 text-gray-500' },
    cancelled: { text: '已取消', cls: 'bg-red-50 text-red-700' },
  };

  const payStatusCfg: Record<string, { text: string; cls: string }> = {
    pending: { text: '待支付', cls: 'bg-amber-50 text-amber-700' },
    paid: { text: '已支付', cls: 'bg-green-50 text-green-700' },
    refunded: { text: '已退款', cls: 'bg-blue-50 text-blue-700' },
    failed: { text: '失败', cls: 'bg-red-50 text-red-700' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">订阅与支付</h1>
        <p className="text-gray-500 text-sm mt-1">查看所有订阅记录和支付流水</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('subscriptions')}
          className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
            tab === 'subscriptions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          订阅记录 ({subs.length})
        </button>
        <button
          onClick={() => setTab('payments')}
          className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
            tab === 'payments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          支付流水 ({pays.length})
        </button>
      </div>

      {subsError && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">加载订阅数据失败</div>
      )}
      {payError && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">加载支付数据失败</div>
      )}

      {tab === 'subscriptions' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">租户</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">插件</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">套餐</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">状态</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">启用</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">开始时间</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">过期时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subsLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
                    </td>
                  </tr>
                ) : subs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">暂无订阅记录</td>
                  </tr>
                ) : (
                  subs.map((s: any) => {
                    const sc = statusCfg[s.status] ?? statusCfg.active;
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500">{s.id}</td>
                        <td className="px-4 py-3 text-gray-900">{s.tenantName ?? s.tenantId}</td>
                        <td className="px-4 py-3 text-gray-700">{s.pluginName ?? s.pluginId}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {s.planType === 'monthly' ? '月付' : s.planType === 'yearly' ? '年付' : '永久'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sc.cls}`}>
                            {sc.text}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.isEnabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {s.isEnabled ? '是' : '否'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {s.startedAt ? new Date(s.startedAt).toLocaleDateString('zh-CN') : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString('zh-CN') : '永久'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">用户</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">租户</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">插件</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">金额</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">渠道</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">状态</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">支付时间</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
                    </td>
                  </tr>
                ) : pays.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">暂无支付记录</td>
                  </tr>
                ) : (
                  pays.map((p: any) => {
                    const ps = payStatusCfg[p.status] ?? payStatusCfg.pending;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500">{p.id}</td>
                        <td className="px-4 py-3 text-gray-900">{p.username ?? p.userId}</td>
                        <td className="px-4 py-3 text-gray-700">{p.tenantName ?? p.tenantId}</td>
                        <td className="px-4 py-3 text-gray-700">{p.pluginName ?? p.pluginId}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          ¥{((p.amount ?? 0) / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{p.provider ?? '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ps.cls}`}>
                            {ps.text}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {p.paidAt ? new Date(p.paidAt).toLocaleString('zh-CN') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {p.status === 'pending' ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  if (confirm('确认到账？')) confirmMutation.mutate(p.id);
                                }}
                                disabled={confirmMutation.isPending}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                              >
                                <Check size={12} />
                                确认到账
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('确认拒绝该支付？')) rejectMutation.mutate(p.id);
                                }}
                                disabled={rejectMutation.isPending}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                <XIcon size={12} />
                                拒绝
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
