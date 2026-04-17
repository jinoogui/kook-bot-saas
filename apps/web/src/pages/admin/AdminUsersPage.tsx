import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import api from '../../lib/api';

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [size] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [mutError, setMutError] = useState('');

  const queryParams = useMemo(() => ({
    page,
    size,
    keyword: keyword || undefined,
    role: role || undefined,
    status: status || undefined,
    startDate: dateFrom || undefined,
    endDate: dateTo || undefined,
  }), [page, size, keyword, role, status, dateFrom, dateTo]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', queryParams],
    queryFn: () => api.admin.getUsers(queryParams).then((r) => r.data),
  });

  const d = (data as any) ?? { rows: [], total: 0 };
  const totalPages = Math.max(1, Math.ceil(d.total / size));

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: { id: number; role?: string; status?: string }) =>
      api.admin.updateUser(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (err: unknown) => {
      const detail = (err as any)?.code
        ? `${(err as any).code}: ${(err as any)?.message || '操作失败'}`
        : ((err as any)?.response?.data?.error || (err as any)?.message || '操作失败');
      setMutError(detail);
      setTimeout(() => setMutError(''), 3000);
    },
  });

  const batchMut = useMutation({
    mutationFn: ({ ids, role, status }: { ids: number[]; role?: string; status?: string }) =>
      api.admin.batchUsers(ids, { role, status }),
    onSuccess: () => {
      setSelectedUserIds([]);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: unknown) => {
      const detail = (err as any)?.code
        ? `${(err as any).code}: ${(err as any)?.message || '批量操作失败'}`
        : ((err as any)?.response?.data?.error || (err as any)?.message || '批量操作失败');
      setMutError(detail);
      setTimeout(() => setMutError(''), 3000);
    },
  });

  const statusLabels: Record<string, { text: string; cls: string }> = {
    active: { text: '正常', cls: 'bg-green-50 text-green-700' },
    suspended: { text: '已禁用', cls: 'bg-red-50 text-red-700' },
    deleted: { text: '已删除', cls: 'bg-gray-100 text-gray-500' },
  };

  const roleLabels: Record<string, { text: string; cls: string }> = {
    admin: { text: '管理员', cls: 'bg-primary-50 text-primary-700' },
    user: { text: '普通用户', cls: 'bg-gray-100 text-gray-600' },
  };

  const resetFilters = () => {
    setKeyword('');
    setRole('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setSelectedUserIds([]);
    setPage(1);
  };

  const allVisibleUserIds = d.rows.map((u: any) => u.id as number);
  const allSelected = allVisibleUserIds.length > 0 && allVisibleUserIds.every((id: number) => selectedUserIds.includes(id));

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...allVisibleUserIds])));
      return;
    }
    setSelectedUserIds((prev) => prev.filter((id) => !allVisibleUserIds.includes(id)));
  };

  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelectedUserIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((v) => v !== id);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
        <p className="text-gray-500 text-sm mt-1">管理平台注册用户</p>
      </div>

      <div className="card grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <input
          className="input-field lg:col-span-2"
          placeholder="搜索邮箱/用户名"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input-field"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">全部角色</option>
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
        </select>
        <select
          className="input-field"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">全部状态</option>
          <option value="active">正常</option>
          <option value="suspended">已禁用</option>
          <option value="deleted">已删除</option>
        </select>
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
          disabled={selectedUserIds.length === 0 || batchMut.isPending}
          onClick={() => batchMut.mutate({ ids: selectedUserIds, status: 'active' })}
        >
          批量启用
        </button>
        <button
          className="btn-secondary"
          disabled={selectedUserIds.length === 0 || batchMut.isPending}
          onClick={() => batchMut.mutate({ ids: selectedUserIds, status: 'suspended' })}
        >
          批量禁用
        </button>
        <button
          className="btn-secondary"
          disabled={selectedUserIds.length === 0 || batchMut.isPending}
          onClick={() => batchMut.mutate({ ids: selectedUserIds, role: 'admin' })}
        >
          批量设为管理员
        </button>
        <button
          className="btn-secondary"
          disabled={selectedUserIds.length === 0 || batchMut.isPending}
          onClick={() => batchMut.mutate({ ids: selectedUserIds, role: 'user' })}
        >
          批量取消管理员
        </button>
        <span className="text-sm text-gray-500">已选 {selectedUserIds.length} 个用户</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg m-4">加载用户列表失败</div>
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
                <th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">邮箱</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">用户名</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">角色</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">状态</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">注册时间</th>
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
              ) : d.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">暂无用户</td>
                </tr>
              ) : (
                d.rows.map((u: any) => {
                  const sl = statusLabels[u.status] ?? statusLabels.active;
                  const rl = roleLabels[u.role] ?? roleLabels.user;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={(e) => toggleSelectOne(u.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500">{u.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{u.email}</td>
                      <td className="px-4 py-3 text-gray-700">{u.username}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${rl.cls}`}>
                          {rl.text}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sl.cls}`}>
                          {sl.text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-CN') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {u.status === 'active' ? (
                            <button
                              onClick={() => updateMut.mutate({ id: u.id, status: 'suspended' })}
                              className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >
                              禁用
                            </button>
                          ) : u.status === 'suspended' ? (
                            <button
                              onClick={() => updateMut.mutate({ id: u.id, status: 'active' })}
                              className="px-2 py-1 text-xs rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                            >
                              启用
                            </button>
                          ) : null}
                          {u.role === 'user' ? (
                            <button
                              onClick={() => updateMut.mutate({ id: u.id, role: 'admin' })}
                              className="px-2 py-1 text-xs rounded bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors"
                            >
                              设为管理员
                            </button>
                          ) : (
                            <button
                              onClick={() => updateMut.mutate({ id: u.id, role: 'user' })}
                              className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              取消管理员
                            </button>
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">共 {d.total} 个用户</p>
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
