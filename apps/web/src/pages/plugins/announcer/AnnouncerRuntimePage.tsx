import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { getErrorText, makeIdempotencyKey, useRuntimeHeader, useRuntimeTenant } from '../runtimeUtils';

interface AnnouncerConfigForm {
  enabled: boolean;
  max_retry: number;
  retry_delay_minutes: number;
}

export default function AnnouncerRuntimePage() {
  const location = useLocation();
  const stateTenantId = (location.state as { tenantId?: string } | undefined)?.tenantId;
  const queryClient = useQueryClient();
  const { selectedTenant, setSelectedTenant, tenants } = useRuntimeTenant(stateTenantId);

  const [guildId, setGuildId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [configForm, setConfigForm] = useState<AnnouncerConfigForm>({
    enabled: true,
    max_retry: 3,
    retry_delay_minutes: 5,
  });
  const [message, setMessage] = useState('');

  const tenantName = useMemo(() => tenants.find((t) => t.id === selectedTenant)?.name, [tenants, selectedTenant]);
  const pageTitle = useRuntimeHeader('Announcer', selectedTenant, tenantName);

  const listQuery = useQuery({
    queryKey: ['runtime-announcer-list', selectedTenant, guildId, taskStatusFilter],
    queryFn: () => api.pluginRuntime.announcer.list(selectedTenant, guildId, { status: taskStatusFilter || undefined }).then((r) => r.data),
    enabled: !!selectedTenant && !!guildId,
  });

  const configQuery = useQuery({
    queryKey: ['runtime-announcer-config', selectedTenant],
    queryFn: () => api.pluginRuntime.announcer.getConfig(selectedTenant).then((r) => r.data),
    enabled: !!selectedTenant,
  });

  const createMutation = useMutation({
    mutationFn: () => api.pluginRuntime.announcer.create(selectedTenant, guildId, {
      title,
      content,
      scheduleAt,
      channelId,
      createdBy,
    }),
    onSuccess: async () => {
      setMessage('公告任务创建成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-announcer-list', selectedTenant, guildId, taskStatusFilter] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const sendNowMutation = useMutation({
    mutationFn: (id: number) => api.pluginRuntime.announcer.sendNow(
      selectedTenant,
      id,
      makeIdempotencyKey(`announcer-send-${selectedTenant}-${id}`),
    ),
    onSuccess: async () => {
      setMessage('立即发送已触发');
      await queryClient.invalidateQueries({ queryKey: ['runtime-announcer-list', selectedTenant, guildId, taskStatusFilter] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.pluginRuntime.announcer.cancel(
      selectedTenant,
      id,
      makeIdempotencyKey(`announcer-cancel-${selectedTenant}-${id}`),
    ),
    onSuccess: async () => {
      setMessage('任务取消成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-announcer-list', selectedTenant, guildId, taskStatusFilter] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const saveConfigMutation = useMutation({
    mutationFn: () => api.pluginRuntime.announcer.saveConfig(selectedTenant, { ...configForm }),
    onSuccess: async () => {
      setMessage('公告配置保存成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-announcer-config', selectedTenant] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const taskRows = Array.isArray((listQuery.data as any)?.rows) ? (listQuery.data as any).rows : [];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{pageTitle}</h2>

      <div className="card text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-800">用法说明</p>
        <p>1) 先完成租户、Guild、频道、创建者信息后创建公告任务。</p>
        <p>2) 在任务列表按状态筛选，必要时执行立即发送或取消。</p>
        <p>3) 结合 retry/lastError 字段定位失败任务。</p>
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-4 gap-3">
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
          <label className="text-sm text-gray-600">频道 ID</label>
          <input className="input-field" value={channelId} onChange={(e) => setChannelId(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-gray-600">创建者 ID</label>
          <input className="input-field" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} />
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">公告配置</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500">enabled</label>
            <select className="input-field" value={configForm.enabled ? 'true' : 'false'} onChange={(e) => setConfigForm((prev) => ({ ...prev, enabled: e.target.value === 'true' }))}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">max_retry</label>
            <input className="input-field" type="number" min={0} max={10} value={configForm.max_retry} onChange={(e) => setConfigForm((prev) => ({ ...prev, max_retry: Math.min(10, Math.max(0, Number(e.target.value) || 0)) }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500">retry_delay_minutes</label>
            <input className="input-field" type="number" min={1} max={120} value={configForm.retry_delay_minutes} onChange={(e) => setConfigForm((prev) => ({ ...prev, retry_delay_minutes: Math.min(120, Math.max(1, Number(e.target.value) || 1)) }))} />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={configQuery.isLoading} onClick={() => {
            const raw = (configQuery.data as any) || {};
            setConfigForm({
              enabled: raw.enabled !== false,
              max_retry: Number(raw.max_retry ?? 3),
              retry_delay_minutes: Number(raw.retry_delay_minutes ?? 5),
            });
          }}>
            从服务端加载
          </button>
          <button className="btn-primary" disabled={!selectedTenant || saveConfigMutation.isPending} onClick={() => saveConfigMutation.mutate()}>
            {saveConfigMutation.isPending ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">创建任务</h3>
        <input className="input-field" placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input-field" placeholder="内容" rows={3} value={content} onChange={(e) => setContent(e.target.value)} />
        <input className="input-field" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
        <button className="btn-primary" disabled={!selectedTenant || !guildId || !channelId || !createdBy || !title || !content || !scheduleAt || createMutation.isPending} onClick={() => createMutation.mutate()}>
          {createMutation.isPending ? '创建中...' : '创建任务'}
        </button>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">任务列表与关键动作</h3>
        <select className="input-field" value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value)}>
          <option value="">全部状态</option>
          <option value="scheduled">scheduled</option>
          <option value="sent">sent</option>
          <option value="failed">failed</option>
          <option value="cancelled">cancelled</option>
        </select>

        {taskRows.length > 0 ? (
          <div className="space-y-2">
            {taskRows.map((row: any) => (
              <div key={row.id} className="border border-gray-200 rounded p-3 space-y-2">
                <p className="font-medium">#{row.id} {row.title}</p>
                <p className="text-xs text-gray-500">status: {row.status} / retry: {row.retryCount} / lastError: {row.lastError || '-'}</p>
                <div className="flex gap-2">
                  <button className="btn-secondary" disabled={sendNowMutation.isPending} onClick={() => sendNowMutation.mutate(row.id)}>立即发送</button>
                  <button className="btn-danger" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(row.id)}>取消任务</button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">暂无任务</p>}
      </div>

      {message ? <div className="card text-sm text-gray-700">{message}</div> : null}
    </div>
  );
}
