import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StopCircle, RefreshCw } from 'lucide-react';
import api from '../../lib/api';

export default function AdminTenantsPage() {
  const qc = useQueryClient();
  const [mutError, setMutError] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => api.admin.getTenants(),
  });

  const rows = (data?.data as any[]) ?? [];

  const stopMut = useMutation({
    mutationFn: (id: string) => api.admin.stopTenant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tenants'] }),
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.error || '操作失败';
      setMutError(msg);
      setTimeout(() => setMutError(''), 3000);
    },
  });

  const restartMut = useMutation({
    mutationFn: (id: string) => api.admin.restartTenant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tenants'] }),
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.error || '操作失败';
      setMutError(msg);
      setTimeout(() => setMutError(''), 3000);
    },
  });

  const statusCfg: Record<string, { text: string; cls: string }> = {
    running: { text: '运行中', cls: 'bg-green-50 text-green-700' },
    stopped: { text: '已停止', cls: 'bg-gray-100 text-gray-500' },
    starting: { text: '启动中', cls: 'bg-blue-50 text-blue-700' },
    error: { text: '异常', cls: 'bg-red-50 text-red-700' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">租户/实例总览</h1>
        <p className="text-gray-500 text-sm mt-1">查看所有 Bot 实例，支持强制停止/重启</p>
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
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">暂无租户</td>
                </tr>
              ) : (
                rows.map((t: any) => {
                  const sc = statusCfg[t.status] ?? statusCfg.stopped;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
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
      </div>
    </div>
  );
}
