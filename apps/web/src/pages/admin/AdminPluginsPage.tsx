import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../../lib/api';

export default function AdminPluginsPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [mutError, setMutError] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-plugins'],
    queryFn: () => api.admin.getPlugins(),
  });

  const rows = (data?.data as any[]) ?? [];

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: any }) =>
      api.admin.updatePlugin(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-plugins'] });
      setEditingId(null);
    },
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.error || '操作失败';
      setMutError(msg);
      setTimeout(() => setMutError(''), 3000);
    },
  });

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      description: p.description ?? '',
      priceMonthly: p.priceMonthly ?? 0,
      priceYearly: p.priceYearly ?? 0,
      tier: p.tier,
      enabled: p.enabled,
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMut.mutate({ id: editingId, ...editForm });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">插件目录管理</h1>
        <p className="text-gray-500 text-sm mt-1">编辑插件价格、描述，上下架管理</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg m-4">加载插件列表失败</div>
        )}
        {mutError && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg m-4">{mutError}</div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">名称</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">分类</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">类型</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">月价</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">年价</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">状态</th>
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
                  <td colSpan={8} className="py-12 text-center text-gray-400">暂无插件</td>
                </tr>
              ) : (
                rows.map((p: any) => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.id}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          />
                        ) : (
                          <span className="font-medium text-gray-900">{p.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{p.category}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                            value={editForm.tier}
                            onChange={e => setEditForm(f => ({ ...f, tier: e.target.value }))}
                          >
                            <option value="free">免费</option>
                            <option value="paid">付费</option>
                          </select>
                        ) : (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.tier === 'free' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {p.tier === 'free' ? '免费' : '付费'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                            value={editForm.priceMonthly}
                            onChange={e => setEditForm(f => ({ ...f, priceMonthly: Number(e.target.value) }))}
                          />
                        ) : (
                          <span className="text-gray-700">
                            {p.priceMonthly ? `¥${(p.priceMonthly / 100).toFixed(0)}` : '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                            value={editForm.priceYearly}
                            onChange={e => setEditForm(f => ({ ...f, priceYearly: Number(e.target.value) }))}
                          />
                        ) : (
                          <span className="text-gray-700">
                            {p.priceYearly ? `¥${(p.priceYearly / 100).toFixed(0)}` : '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <button
                            onClick={() => setEditForm(f => ({ ...f, enabled: f.enabled ? 0 : 1 }))}
                            className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                              editForm.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {editForm.enabled ? '已上架' : '已下架'}
                          </button>
                        ) : (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {p.enabled ? '已上架' : '已下架'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button
                              onClick={saveEdit}
                              disabled={updateMut.isPending}
                              className="px-2 py-1 text-xs rounded bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(p)}
                            className="px-2 py-1 text-xs rounded bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors"
                          >
                            编辑
                          </button>
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
    </div>
  );
}
