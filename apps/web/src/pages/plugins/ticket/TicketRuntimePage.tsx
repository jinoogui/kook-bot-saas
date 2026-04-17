import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { getErrorText, makeIdempotencyKey, useRuntimeHeader, useRuntimeTenant } from '../runtimeUtils';

interface TicketConfigForm {
  support_channel_id: string;
  default_priority: 'low' | 'normal' | 'high';
  auto_close_hours: number;
}

export default function TicketRuntimePage() {
  const location = useLocation();
  const stateTenantId = (location.state as { tenantId?: string } | undefined)?.tenantId;
  const queryClient = useQueryClient();
  const { selectedTenant, setSelectedTenant, tenants } = useRuntimeTenant(stateTenantId);

  const [guildId, setGuildId] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [operatorUserId, setOperatorUserId] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [detailTicketId, setDetailTicketId] = useState('');
  const [configForm, setConfigForm] = useState<TicketConfigForm>({
    support_channel_id: '',
    default_priority: 'normal',
    auto_close_hours: 72,
  });
  const [message, setMessage] = useState<string>('');

  const tenantName = useMemo(() => tenants.find((t) => t.id === selectedTenant)?.name, [tenants, selectedTenant]);
  const pageTitle = useRuntimeHeader('Ticket 管理', selectedTenant, tenantName);
  const selectedTicketId = useMemo(() => {
    const id = Number(detailTicketId);
    return Number.isInteger(id) && id > 0 ? id : null;
  }, [detailTicketId]);

  const listQuery = useQuery({
    queryKey: ['runtime-ticket-list', selectedTenant, guildId, statusFilter],
    queryFn: () => api.pluginRuntime.ticket.list(selectedTenant, guildId, { status: statusFilter || undefined }).then((r) => r.data),
    enabled: !!selectedTenant && !!guildId,
  });

  const detailQuery = useQuery({
    queryKey: ['runtime-ticket-detail', selectedTenant, selectedTicketId],
    queryFn: () => api.pluginRuntime.ticket.detail(selectedTenant, selectedTicketId as number).then((r) => r.data),
    enabled: !!selectedTenant && !!selectedTicketId,
  });

  const configQuery = useQuery({
    queryKey: ['runtime-ticket-config', selectedTenant],
    queryFn: () => api.pluginRuntime.ticket.getConfig(selectedTenant).then((r) => r.data),
    enabled: !!selectedTenant,
  });

  const configDocs = useMemo(() => {
    const docs = (configQuery.data as any)?.docs;
    return docs || {
      support_channel_id: '默认受理频道；为空时创建接口需显式传 channelId',
      default_priority: '工单默认优先级，可选 low/normal/high',
      auto_close_hours: '自动关闭阈值（小时），0 表示关闭自动关闭',
    };
  }, [configQuery.data]);

  const assignMutation = useMutation({
    mutationFn: (id: number) => api.pluginRuntime.ticket.assign(selectedTenant, id, {
      assigneeUserId,
      operatorUserId,
      operatorRole: 'admin',
    }),
    onSuccess: async () => {
      setMessage('指派已提交');
      await queryClient.invalidateQueries({ queryKey: ['runtime-ticket-list', selectedTenant, guildId, statusFilter] });
      if (selectedTicketId) {
        await queryClient.invalidateQueries({ queryKey: ['runtime-ticket-detail', selectedTenant, selectedTicketId] });
      }
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const closeMutation = useMutation({
    mutationFn: (id: number) => api.pluginRuntime.ticket.close(
      selectedTenant,
      id,
      { operatorUserId, reason: closeReason || 'runtime_close', operatorRole: 'admin' },
      makeIdempotencyKey(`ticket-close-${selectedTenant}-${id}`),
    ),
    onSuccess: async () => {
      setMessage('关闭操作已提交');
      await queryClient.invalidateQueries({ queryKey: ['runtime-ticket-list', selectedTenant, guildId, statusFilter] });
      if (selectedTicketId) {
        await queryClient.invalidateQueries({ queryKey: ['runtime-ticket-detail', selectedTenant, selectedTicketId] });
      }
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const saveConfigMutation = useMutation({
    mutationFn: () => api.pluginRuntime.ticket.saveConfig(selectedTenant, { ...configForm }),
    onSuccess: async () => {
      setMessage('配置保存成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-ticket-config', selectedTenant] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const ticketRows = Array.isArray((listQuery.data as any)?.rows) ? (listQuery.data as any).rows : [];
  const selectedTicket = useMemo(
    () => ticketRows.find((row: any) => Number(row.id) === selectedTicketId),
    [ticketRows, selectedTicketId],
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{pageTitle}</h2>

      <div className="card text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-800">用法说明</p>
        <p>1) 先选择租户并填写 Guild ID，队列默认展示 open 工单。</p>
        <p>2) 在“工单处理队列”点击“进入处理”，再在“管理处理面板”执行指派或关闭。</p>
        <p>3) 操作后查看“工单详情与日志”，确认状态和处理记录。</p>
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-gray-600">租户</label>
          <select className="input-field" value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)}>
            <option value="">请选择</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600">Guild ID</label>
          <input className="input-field" value={guildId} onChange={(e) => setGuildId(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-gray-600">状态筛选</label>
          <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">全部</option>
            <option value="open">open（待处理）</option>
            <option value="processing">processing（处理中）</option>
            <option value="closed">closed（已关闭）</option>
          </select>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">工单配置</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500">support_channel_id</label>
            <input
              className="input-field"
              value={configForm.support_channel_id}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, support_channel_id: e.target.value }))}
            />
            <p className="text-xs text-gray-400 mt-1">{configDocs.support_channel_id}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">default_priority</label>
            <select
              className="input-field"
              value={configForm.default_priority}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, default_priority: e.target.value as TicketConfigForm['default_priority'] }))}
            >
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">{configDocs.default_priority}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">auto_close_hours</label>
            <input
              className="input-field"
              type="number"
              min={0}
              value={configForm.auto_close_hours}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, auto_close_hours: Math.max(0, Number(e.target.value) || 0) }))}
            />
            <p className="text-xs text-gray-400 mt-1">{configDocs.auto_close_hours}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => {
            const raw = (configQuery.data as any) || {};
            setConfigForm({
              support_channel_id: String(raw.support_channel_id || ''),
              default_priority: (raw.default_priority || 'normal') as TicketConfigForm['default_priority'],
              auto_close_hours: Number(raw.auto_close_hours ?? 72),
            });
          }} disabled={configQuery.isLoading}>
            从服务端加载
          </button>
          <button className="btn-primary" onClick={() => saveConfigMutation.mutate()} disabled={!selectedTenant || saveConfigMutation.isPending}>
            {saveConfigMutation.isPending ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">工单处理队列</h3>
        {ticketRows.length > 0 ? (
          <div className="space-y-2">
            {ticketRows.map((row: any) => (
              <div key={row.id} className="border border-gray-200 rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">#{row.id} {row.title}</p>
                    <p className="text-xs text-gray-500">status: {row.status} / priority: {row.priority} / assignee: {row.assigneeUserId || '-'}</p>
                  </div>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setDetailTicketId(String(row.id));
                      setAssigneeUserId(String(row.assigneeUserId || ''));
                    }}
                  >
                    进入处理
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">暂无工单</p>
        )}
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">管理处理面板</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="input-field"
            placeholder="工单 ID"
            value={detailTicketId}
            onChange={(e) => setDetailTicketId(e.target.value)}
          />
          <input
            className="input-field"
            placeholder="操作人 userId"
            value={operatorUserId}
            onChange={(e) => setOperatorUserId(e.target.value)}
          />
          <input
            className="input-field"
            placeholder="指派到 userId"
            value={assigneeUserId}
            onChange={(e) => setAssigneeUserId(e.target.value)}
          />
          <input
            className="input-field"
            placeholder="关闭原因（可选）"
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
          />
        </div>

        {selectedTicket ? (
          <p className="text-xs text-gray-500">当前处理: #{selectedTicket.id} / status: {selectedTicket.status} / assignee: {selectedTicket.assigneeUserId || '-'}</p>
        ) : (
          <p className="text-xs text-gray-500">当前未选择队列中的工单，可手动输入工单 ID。</p>
        )}

        <div className="flex gap-2">
          <button
            className="btn-secondary"
            disabled={!selectedTicketId || !operatorUserId || !assigneeUserId || assignMutation.isPending}
            onClick={() => assignMutation.mutate(selectedTicketId as number)}
          >
            {assignMutation.isPending ? '指派中...' : '执行指派'}
          </button>
          <button
            className="btn-danger"
            disabled={!selectedTicketId || !operatorUserId || closeMutation.isPending}
            onClick={() => closeMutation.mutate(selectedTicketId as number)}
          >
            {closeMutation.isPending ? '关闭中...' : '执行关闭'}
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">工单详情与日志</h3>
        {detailQuery.isLoading ? <p className="text-sm text-gray-500">详情加载中...</p> : null}
        {detailQuery.data ? (
          <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto">{JSON.stringify(detailQuery.data, null, 2)}</pre>
        ) : (
          <p className="text-sm text-gray-500">暂无详情</p>
        )}
      </div>

      {message ? <div className="card text-sm text-gray-700">{message}</div> : null}
    </div>
  );
}
