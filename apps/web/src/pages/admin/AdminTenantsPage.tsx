import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StopCircle, RefreshCw } from 'lucide-react';
import api from '../../lib/api';

export default function AdminTenantsPage() {
  const qc = useQueryClient();
  const [mutError, setMutError] = useState('');
  const [page, setPage] = useState(1);
  const [size] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);

  const queryParams = useMemo(() => ({
    page,
    size,
    keyword: keyword || undefined,
    status: status || undefined,
    ownerId: ownerId ? Number(ownerId) : undefined,
    startDate: dateFrom || undefined,
    endDate: dateTo || undefined,
  }), [page, size, keyword, status, ownerId, dateFrom, dateTo]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-tenants', queryParams],
    queryFn: () => api.admin.getTenants(queryParams).then((r) => r.data),
  });

  const rows = ((data as any)?.rows as any[]) ?? [];
  const total = (data as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / size));

  const stopMut = useMutation({
    mutationFn: (id: string) => api.admin.stopTenant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tenants'] }),
    onError: (err: unknown) => {
      const detail = (err as any)?.code
        ? `${(err as any).code}: ${(err as any)?.message || '操作失败'}`
        : ((err as any)?.response?.data?.error || (err as any)?.message || '操作失败');
      setMutError(detail);
      setTimeout(() => setMutError(''), 3000);
    },
  });

  const restartMut = useMutation({
    mutationFn: (id: string) => api.admin.restartTenant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tenants'] }),
    onError: (err: unknown) => {
      const detail = (err as any)?.code
        ? `${(err as any).code}: ${(err as any)?.message || '操作失败'}`
        : ((err as any)?.response?.data?.error || (err as any)?.message || '操作失败');
      setMutError(detail);
      setTimeout(() => setMutError(''), 3000);
    },
  });

  const batchMut = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: 'stop' | 'restart' }) =>
      api.admin.batchTenants(ids, action),
    onSuccess: () => {
      setSelectedTenantIds([]);
      qc.invalidateQueries({ queryKey: ['admin-tenants'] });
    },
    onError: (err: unknown) => {
      const detail = (err as any)?.code
        ? `${(err as any).code}: ${(err as any)?.message || '批量操作失败'}`
        : ((err as any)?.response?.data?.error || (err as any)?.message || '批量操作失败');
      setMutError(detail);
      setTimeout(() => setMutError(''), 3000);
    },
  });

  const statusCfg: Record<string, { text: string; cls: string }> = {
    running: { text: '运行中', cls: 'bg-green-50 text-green-700' },
    stopped: { text: '已停止', cls: 'bg-gray-100 text-gray-500' },
    starting: { text: '启动中', cls: 'bg-blue-50 text-blue-700' },
    stopping: { text: '停止中', cls: 'bg-amber-50 text-amber-700' },
    error: { text: '异常', cls: 'bg-red-50 text-red-700' },
  };

  const resetFilters = () => {
    setKeyword('');
    setStatus('');
    setOwnerId('');
    setDateFrom('');
    setDateTo('');
    setSelectedTenantIds([]);
    setPage(1);
  };

  const allVisibleTenantIds = rows.map((t: any) => t.id as string);
  const allSelected = allVisibleTenantIds.length > 0 && allVisibleTenantIds.every((id) => selectedTenantIds.includes(id));

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTenantIds(Array.from(new Set([...selectedTenantIds, ...allVisibleTenantIds])));
      return;
    }
    setSelectedTenantIds((prev) => prev.filter((id) => !allVisibleTenantIds.includes(id)));
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedTenantIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((v) => v !== id);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">租户/实例总览</h1>
        <p className="text-gray-500 text-sm mt-1">查看所有 Bot 实例，支持强制停止/重启</p>
      </div>

      <div className="card grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <input
          className="input-field lg:col-span-2"
          placeholder="搜索租户名/邮箱/用户名"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input-field"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">全部状态</option>
          <option value="running">运行中</option>
          <option value="starting">启动中</option>
          <option value="stopping">停止中</option>
          <option value="stopped">已停止</option>
          <option value="error">异常</option>
        </select>
        <input
          type="number"
          min={1}
          className="input-field"
          placeholder="所属用户ID"
          value={ownerId}
          onChange={(e) => {
            setOwnerId(e.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          className="input-field"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          className="input-field"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />
        <button className="btn-secondary" onClick={resetFilters}>重置筛选</button>
      </div>

      <div className="card flex items-center gap-2 flex-wrap">
        <button
          className="btn-secondary"
          disabled={selectedTenantIds.length === 0 || batchMut.isPending}
          onClick={() => batchMut.mutate({ ids: selectedTenantIds, action: 'stop' })}
        >
          批量停止
        </button>
        <button
          className="btn-secondary"
          disabled={selectedTenantIds.length === 0 || batchMut.isPending}
          onClick={() => batchMut.mutate({ ids: selectedTenantIds, action: 'restart' })}
        >
          批量重启
        </button>
        <span className="text-sm text-gray-500">已选 {selectedTenantIds.length} 个租户</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg m-4">加载租户列表失败</div>
        )}
        {mutError && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg m-4">{mutError}</div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  <input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)} />
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">名称</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">所属用户</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">状态</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">端口</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">最后心跳</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">创建时间</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">暂无租户</td>
                </tr>
              ) : (
                rows.map((t: any) => {
                  const sc = statusCfg[t.status] ?? statusCfg.stopped;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedTenantIds.includes(t.id)}
                          onChange={(e) => toggleSelectOne(t.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {t.ownerUsername ?? '-'}
                        <span className="text-gray-400 text-xs ml-1">({t.ownerEmail})</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sc.cls}`}>
                          {sc.text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {t.assignedPort ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {t.lastHeartbeat ? new Date(t.lastHeartbeat).toLocaleString('zh-CN') : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString('zh-CN') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {t.status === 'running' && (
                            <button
                              onClick={() => stopMut.mutate(t.id)}
                              disabled={stopMut.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              <StopCircle size={12} /> 停止
                            </button>
                          )}
                          <button
                            onClick={() => restartMut.mutate(t.id)}
                            disabled={restartMut.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw size={12} /> 重启
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">共 {total} 个租户</p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
              >
                上一页
              </button>
              <span className="px-3 py-1 text-sm text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
