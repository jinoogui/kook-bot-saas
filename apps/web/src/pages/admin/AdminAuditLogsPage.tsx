import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../lib/api';

const ACTION_OPTIONS = [
  { value: '', label: '全部操作' },
  { value: 'tenant.create', label: '创建租户' },
  { value: 'tenant.delete', label: '删除租户' },
  { value: 'instance.start', label: '启动实例' },
  { value: 'instance.stop', label: '停止实例' },
  { value: 'instance.restart', label: '重启实例' },
  { value: 'subscription.create', label: '创建订阅' },
  { value: 'subscription.cancel', label: '取消订阅' },
  { value: 'subscription.config_update', label: '更新配置' },
  { value: 'user.role_change', label: '角色变更' },
  { value: 'user.status_change', label: '状态变更' },
  { value: 'plugin.update', label: '插件修改' },
  { value: 'payment.confirm', label: '确认支付' },
  { value: 'payment.reject', label: '拒绝支付' },
];

export default function AdminAuditLogsPage() {
  const [action, setAction] = useState('');
  const [userIdInput, setUserIdInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-audit-logs', action, userIdInput, startDate, endDate, page],
    queryFn: () =>
      api.admin.getAuditLogs({
        action: action || undefined,
        userId: userIdInput ? parseInt(userIdInput, 10) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        size: 20,
      }),
  });

  const rows = (data?.data as any)?.rows ?? [];
  const total = (data?.data as any)?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const parseDetails = (details: string | null | undefined) => {
    if (!details) return null;
    try {
      return JSON.parse(details);
    } catch {
      return details;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">审计日志</h1>
        <p className="text-gray-500 text-sm mt-1">查看平台操作审计记录</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">操作类型</label>
            <select
              className="input-field text-sm"
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">用户 ID</label>
            <input
              type="number"
              className="input-field text-sm"
              placeholder="输入用户 ID"
              value={userIdInput}
              onChange={(e) => { setUserIdInput(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">开始日期</label>
            <input
              type="date"
              className="input-field text-sm"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">结束日期</label>
            <input
              type="date"
              className="input-field text-sm"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">加载审计日志失败</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">时间</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">用户</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">操作</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">资源</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">资源 ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">IP</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">暂无审计记录</td>
                </tr>
              ) : (
                rows.map((row: any) => (
                  <>
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {row.username || row.email || row.userId}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">
                          {row.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.resource}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono max-w-[200px] truncate">
                        {row.resourceId || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{row.ipAddress || '-'}</td>
                      <td className="px-4 py-3">
                        {row.details ? (
                          <button
                            onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                            className="text-xs text-primary-600 hover:text-primary-700"
                          >
                            {expandedRow === row.id ? '收起' : '查看'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                    {expandedRow === row.id && row.details && (
                      <tr key={`${row.id}-details`}>
                        <td colSpan={7} className="px-4 py-3 bg-gray-50">
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                            {JSON.stringify(parseDetails(row.details), null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            共 {total} 条记录，第 {page}/{totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
