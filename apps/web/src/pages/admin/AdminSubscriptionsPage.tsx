import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Check, X as XIcon, Download } from 'lucide-react';
import api, { type PaymentRiskDecision } from '../../lib/api';

type Tab = 'subscriptions' | 'payments';

export default function AdminSubscriptionsPage() {
  const [tab, setTab] = useState<Tab>('subscriptions');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [subPage, setSubPage] = useState(1);
  const [payPage, setPayPage] = useState(1);
  const [pageSize] = useState(20);

  const [subKeyword, setSubKeyword] = useState('');
  const [subStatus, setSubStatus] = useState('');
  const [subPlanType, setSubPlanType] = useState('');
  const [subDateFrom, setSubDateFrom] = useState('');
  const [subDateTo, setSubDateTo] = useState('');

  const [payKeyword, setPayKeyword] = useState('');
  const [payStatus, setPayStatus] = useState('');
  const [payProvider, setPayProvider] = useState('');
  const [payDateFrom, setPayDateFrom] = useState('');
  const [payDateTo, setPayDateTo] = useState('');
  const [payRiskDecision, setPayRiskDecision] = useState<'' | PaymentRiskDecision>('');

  const [selectedPaymentIds, setSelectedPaymentIds] = useState<number[]>([]);

  const queryClient = useQueryClient();

  const subParams = useMemo(() => ({
    page: subPage,
    size: pageSize,
    keyword: subKeyword || undefined,
    status: subStatus || undefined,
    planType: subPlanType || undefined,
    startDate: subDateFrom || undefined,
    endDate: subDateTo || undefined,
  }), [subPage, pageSize, subKeyword, subStatus, subPlanType, subDateFrom, subDateTo]);

  const payParams = useMemo(() => ({
    page: payPage,
    size: pageSize,
    keyword: payKeyword || undefined,
    status: payStatus || undefined,
    provider: payProvider || undefined,
    riskDecision: payRiskDecision || undefined,
    startDate: payDateFrom || undefined,
    endDate: payDateTo || undefined,
  }), [payPage, pageSize, payKeyword, payStatus, payProvider, payRiskDecision, payDateFrom, payDateTo]);

  const { data: subsData, isLoading: subsLoading, error: subsError } = useQuery({
    queryKey: ['admin-subscriptions', subParams],
    queryFn: () => api.admin.getSubscriptions(subParams).then((r) => r.data),
  });

  const { data: payData, isLoading: payLoading, error: payError } = useQuery({
    queryKey: ['admin-payments', payParams],
    queryFn: () => api.admin.getPayments(payParams).then((r) => r.data),
  });

  const subs = ((subsData as any)?.rows as any[]) ?? [];
  const pays = ((payData as any)?.rows as any[]) ?? [];
  const subTotal = (subsData as any)?.total ?? 0;
  const payTotal = (payData as any)?.total ?? 0;
  const subTotalPages = Math.max(1, Math.ceil(subTotal / pageSize));
  const payTotalPages = Math.max(1, Math.ceil(payTotal / pageSize));

  const refreshTables = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
  };

  const confirmMutation = useMutation({
    mutationFn: (id: number) => api.admin.confirmPayment(id),
    onSuccess: (res) => {
      refreshTables();
      const outcome = (res.data as any)?.outcome;
      setActionMessage({
        type: 'success',
        text: outcome === 'already_confirmed' ? '该支付已确认，无需重复处理' : '支付确认成功',
      });
      setTimeout(() => setActionMessage(null), 3000);
    },
    onError: (err: unknown) => {
      const detail = (err as any)?.code
        ? `${(err as any).code}: ${(err as any)?.message || '确认失败'}`
        : ((err as any)?.response?.data?.error || (err as any)?.message || '确认失败');
      setActionMessage({ type: 'error', text: detail });
      setTimeout(() => setActionMessage(null), 3000);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => api.admin.rejectPayment(id),
    onSuccess: (res) => {
      refreshTables();
      const outcome = (res.data as any)?.outcome;
      setActionMessage({
        type: 'success',
        text: outcome === 'already_rejected' ? '该支付已拒绝，无需重复处理' : '支付拒绝成功',
      });
      setTimeout(() => setActionMessage(null), 3000);
    },
    onError: (err: unknown) => {
      const detail = (err as any)?.code
        ? `${(err as any).code}: ${(err as any)?.message || '拒绝失败'}`
        : ((err as any)?.response?.data?.error || (err as any)?.message || '拒绝失败');
      setActionMessage({ type: 'error', text: detail });
      setTimeout(() => setActionMessage(null), 3000);
    },
  });

  const refundMutation = useMutation({
    mutationFn: (id: number) => api.admin.refundPayment(id),
    onSuccess: (res) => {
      refreshTables();
      const outcome = (res.data as any)?.outcome;
      setActionMessage({
        type: 'success',
        text: outcome === 'already_refunded' ? '该支付已退款，无需重复处理' : '支付退款成功',
      });
      setTimeout(() => setActionMessage(null), 3000);
    },
    onError: (err: unknown) => {
      const detail = (err as any)?.code
        ? `${(err as any).code}: ${(err as any)?.message || '退款失败'}`
        : ((err as any)?.response?.data?.error || (err as any)?.message || '退款失败');
      setActionMessage({ type: 'error', text: detail });
      setTimeout(() => setActionMessage(null), 3000);
    },
  });

  const batchMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: number[]; action: 'confirm' | 'reject' }) => api.admin.batchPayments(ids, action),
    onSuccess: (res, vars) => {
      refreshTables();
      const data = (res.data as any) || {};
      setActionMessage({
        type: 'success',
        text: `批量${vars.action === 'confirm' ? '确认' : '拒绝'}完成：成功 ${data.successCount ?? 0}，失败 ${data.failedCount ?? 0}`,
      });
      setSelectedPaymentIds([]);
      setTimeout(() => setActionMessage(null), 4000);
    },
    onError: (err: unknown) => {
      const detail = (err as any)?.code
        ? `${(err as any).code}: ${(err as any)?.message || '批量处理失败'}`
        : ((err as any)?.response?.data?.error || (err as any)?.message || '批量处理失败');
      setActionMessage({ type: 'error', text: detail });
      setTimeout(() => setActionMessage(null), 3000);
    },
  });

  const exportSubscriptionsMutation = useMutation({
    mutationFn: () => api.admin.exportSubscriptionsCsv(subParams),
    onSuccess: (res) => {
      downloadCsv(res.data as Blob, `subscriptions-${Date.now()}.csv`);
      setActionMessage({ type: 'success', text: '订阅报表导出成功' });
      setTimeout(() => setActionMessage(null), 3000);
    },
    onError: (err: unknown) => {
      const detail = (err as any)?.code
        ? `${(err as any).code}: ${(err as any)?.message || '导出失败'}`
        : ((err as any)?.response?.data?.error || (err as any)?.message || '导出失败');
      setActionMessage({ type: 'error', text: detail });
      setTimeout(() => setActionMessage(null), 3000);
    },
  });

  const exportPaymentsMutation = useMutation({
    mutationFn: () => api.admin.exportPaymentsCsv(payParams),
    onSuccess: (res) => {
      downloadCsv(res.data as Blob, `payments-${Date.now()}.csv`);
      setActionMessage({ type: 'success', text: '支付报表导出成功' });
      setTimeout(() => setActionMessage(null), 3000);
    },
    onError: (err: unknown) => {
      const detail = (err as any)?.code
        ? `${(err as any).code}: ${(err as any)?.message || '导出失败'}`
        : ((err as any)?.response?.data?.error || (err as any)?.message || '导出失败');
      setActionMessage({ type: 'error', text: detail });
      setTimeout(() => setActionMessage(null), 3000);
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

  const riskCfg: Record<string, { text: string; cls: string }> = {
    pass: { text: '通过', cls: 'bg-green-50 text-green-700' },
    review: { text: '人工复核', cls: 'bg-amber-50 text-amber-700' },
    reject: { text: '自动拒绝', cls: 'bg-red-50 text-red-700' },
  };

  const pendingPaymentIds = pays.filter((p) => p.status === 'pending').map((p) => p.id as number);

  const togglePaymentSelection = (id: number, checked: boolean) => {
    setSelectedPaymentIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((v) => v !== id);
    });
  };

  const toggleAllPending = (checked: boolean) => {
    if (checked) {
      setSelectedPaymentIds(Array.from(new Set([...selectedPaymentIds, ...pendingPaymentIds])));
      return;
    }
    setSelectedPaymentIds((prev) => prev.filter((id) => !pendingPaymentIds.includes(id)));
  };

  const resetSubFilters = () => {
    setSubKeyword('');
    setSubStatus('');
    setSubPlanType('');
    setSubDateFrom('');
    setSubDateTo('');
    setSubPage(1);
  };

  const resetPayFilters = () => {
    setPayKeyword('');
    setPayStatus('');
    setPayProvider('');
    setPayDateFrom('');
    setPayDateTo('');
    setPayRiskDecision('');
    setPayPage(1);
    setSelectedPaymentIds([]);
  };

  const downloadCsv = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
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
          订阅记录 ({subTotal})
        </button>
        <button
          onClick={() => setTab('payments')}
          className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
            tab === 'payments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          支付流水 ({payTotal})
        </button>
      </div>

      {subsError && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">加载订阅数据失败</div>
      )}
      {payError && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">加载支付数据失败</div>
      )}
      {actionMessage && (
        <div className={`text-sm p-3 rounded-lg ${actionMessage.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {actionMessage.text}
        </div>
      )}

      {tab === 'subscriptions' && (
        <>
          <div className="card grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <input
              className="input-field lg:col-span-2"
              placeholder="搜索租户/插件"
              value={subKeyword}
              onChange={(e) => {
                setSubKeyword(e.target.value);
                setSubPage(1);
              }}
            />
            <select
              className="input-field"
              value={subStatus}
              onChange={(e) => {
                setSubStatus(e.target.value);
                setSubPage(1);
              }}
            >
              <option value="">全部状态</option>
              <option value="active">有效</option>
              <option value="pending">待确认</option>
              <option value="expired">已过期</option>
              <option value="cancelled">已取消</option>
            </select>
            <select
              className="input-field"
              value={subPlanType}
              onChange={(e) => {
                setSubPlanType(e.target.value);
                setSubPage(1);
              }}
            >
              <option value="">全部套餐</option>
              <option value="monthly">月付</option>
              <option value="yearly">年付</option>
              <option value="lifetime">永久</option>
            </select>
            <input
              type="date"
              className="input-field"
              value={subDateFrom}
              onChange={(e) => {
                setSubDateFrom(e.target.value);
                setSubPage(1);
              }}
            />
            <input
              type="date"
              className="input-field"
              value={subDateTo}
              onChange={(e) => {
                setSubDateTo(e.target.value);
                setSubPage(1);
              }}
            />
            <button className="btn-secondary" onClick={resetSubFilters}>重置筛选</button>
            <button
              className="btn-primary inline-flex items-center gap-1"
              disabled={exportSubscriptionsMutation.isPending}
              onClick={() => exportSubscriptionsMutation.mutate()}
            >
              <Download size={14} />
              {exportSubscriptionsMutation.isPending ? '导出中...' : '导出 CSV'}
            </button>
          </div>

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

            {subTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-500">共 {subTotal} 条订阅记录</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                    disabled={subPage <= 1}
                    className="px-3 py-1 text-sm rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
                  >
                    上一页
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-500">{subPage} / {subTotalPages}</span>
                  <button
                    onClick={() => setSubPage((p) => Math.min(subTotalPages, p + 1))}
                    disabled={subPage >= subTotalPages}
                    className="px-3 py-1 text-sm rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'payments' && (
        <>
          <div className="card grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <input
              className="input-field lg:col-span-2"
              placeholder="搜索用户/租户/插件"
              value={payKeyword}
              onChange={(e) => {
                setPayKeyword(e.target.value);
                setPayPage(1);
              }}
            />
            <select
              className="input-field"
              value={payStatus}
              onChange={(e) => {
                setPayStatus(e.target.value);
                setPayPage(1);
                setSelectedPaymentIds([]);
              }}
            >
              <option value="">全部状态</option>
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="refunded">已退款</option>
              <option value="failed">失败</option>
            </select>
            <input
              className="input-field"
              placeholder="支付渠道（如 manual）"
              value={payProvider}
              onChange={(e) => {
                setPayProvider(e.target.value);
                setPayPage(1);
              }}
            />
            <select
              className="input-field"
              value={payRiskDecision}
              onChange={(e) => {
                setPayRiskDecision(e.target.value as '' | PaymentRiskDecision);
                setPayPage(1);
                setSelectedPaymentIds([]);
              }}
            >
              <option value="">全部风控</option>
              <option value="pass">通过</option>
              <option value="review">人工复核</option>
              <option value="reject">自动拒绝</option>
            </select>
            <input
              type="date"
              className="input-field"
              value={payDateFrom}
              onChange={(e) => {
                setPayDateFrom(e.target.value);
                setPayPage(1);
              }}
            />
            <input
              type="date"
              className="input-field"
              value={payDateTo}
              onChange={(e) => {
                setPayDateTo(e.target.value);
                setPayPage(1);
              }}
            />
            <button className="btn-secondary" onClick={resetPayFilters}>重置筛选</button>
            <button
              className="btn-primary inline-flex items-center gap-1"
              disabled={exportPaymentsMutation.isPending}
              onClick={() => exportPaymentsMutation.mutate()}
            >
              <Download size={14} />
              {exportPaymentsMutation.isPending ? '导出中...' : '导出 CSV'}
            </button>
          </div>

          <div className="card flex items-center gap-2 flex-wrap">
            <button
              className="btn-primary"
              disabled={selectedPaymentIds.length === 0 || batchMutation.isPending}
              onClick={() => batchMutation.mutate({ ids: selectedPaymentIds, action: 'confirm' })}
            >
              批量确认到账
            </button>
            <button
              className="btn-secondary"
              disabled={selectedPaymentIds.length === 0 || batchMutation.isPending}
              onClick={() => batchMutation.mutate({ ids: selectedPaymentIds, action: 'reject' })}
            >
              批量拒绝
            </button>
            <span className="text-sm text-gray-500">已选 {selectedPaymentIds.length} 条待支付记录</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      <input
                        type="checkbox"
                        checked={pendingPaymentIds.length > 0 && pendingPaymentIds.every((id) => selectedPaymentIds.includes(id))}
                        onChange={(e) => toggleAllPending(e.target.checked)}
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">用户</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">租户</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">插件</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">金额</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">渠道</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">状态</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">风控</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">支付时间</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payLoading ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-gray-400">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
                      </td>
                    </tr>
                  ) : pays.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-gray-400">暂无支付记录</td>
                    </tr>
                  ) : (
                    pays.map((p: any) => {
                      const ps = payStatusCfg[p.status] ?? payStatusCfg.pending;
                      const risk = riskCfg[p.riskDecision ?? 'pass'] ?? riskCfg.pass;
                      const checked = selectedPaymentIds.includes(p.id);
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            {p.status === 'pending' ? (
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => togglePaymentSelection(p.id, e.target.checked)}
                              />
                            ) : null}
                          </td>
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
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1 max-w-[220px]">
                              <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${risk.cls}`}>
                                {risk.text}
                              </span>
                              {p.riskReason ? (
                                <span className="text-xs text-gray-500 truncate" title={p.riskReason}>
                                  {p.riskReason}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {p.paidAt ? new Date(p.paidAt).toLocaleString('zh-CN') : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {p.status === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => confirmMutation.mutate(p.id)}
                                    disabled={confirmMutation.isPending}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                  >
                                    <Check size={12} />
                                    确认到账
                                  </button>
                                  <button
                                    onClick={() => rejectMutation.mutate(p.id)}
                                    disabled={rejectMutation.isPending}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                  >
                                    <XIcon size={12} />
                                    拒绝
                                  </button>
                                </>
                              ) : p.status === 'paid' ? (
                                <button
                                  onClick={() => refundMutation.mutate(p.id)}
                                  disabled={refundMutation.isPending}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                  退款
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {payTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-500">共 {payTotal} 条支付记录</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPayPage((p) => Math.max(1, p - 1))}
                    disabled={payPage <= 1}
                    className="px-3 py-1 text-sm rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
                  >
                    上一页
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-500">{payPage} / {payTotalPages}</span>
                  <button
                    onClick={() => setPayPage((p) => Math.min(payTotalPages, p + 1))}
                    disabled={payPage >= payTotalPages}
                    className="px-3 py-1 text-sm rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
