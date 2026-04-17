import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { getErrorText, makeIdempotencyKey, useRuntimeHeader, useRuntimeTenant } from '../runtimeUtils';

interface EventsConfigForm {
  reminder_before_minutes: number;
  default_max_participants: number;
}

export default function EventsRuntimePage() {
  const location = useLocation();
  const stateTenantId = (location.state as { tenantId?: string } | undefined)?.tenantId;
  const queryClient = useQueryClient();
  const { selectedTenant, setSelectedTenant, tenants } = useRuntimeTenant(stateTenantId);

  const [guildId, setGuildId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [creatorUserId, setCreatorUserId] = useState('');
  const [joinUserId, setJoinUserId] = useState('');
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [configForm, setConfigForm] = useState<EventsConfigForm>({
    reminder_before_minutes: 30,
    default_max_participants: 0,
  });
  const [message, setMessage] = useState('');

  const tenantName = useMemo(() => tenants.find((t) => t.id === selectedTenant)?.name, [tenants, selectedTenant]);
  const pageTitle = useRuntimeHeader('Events', selectedTenant, tenantName);

  const listQuery = useQuery({
    queryKey: ['runtime-events-list', selectedTenant, guildId],
    queryFn: () => api.pluginRuntime.events.list(selectedTenant, guildId).then((r) => r.data),
    enabled: !!selectedTenant && !!guildId,
  });

  const participantsQuery = useQuery({
    queryKey: ['runtime-events-participants', selectedTenant, selectedEventId],
    queryFn: () => api.pluginRuntime.events.participants(selectedTenant, selectedEventId as number).then((r) => r.data),
    enabled: !!selectedTenant && !!selectedEventId,
  });

  const configQuery = useQuery({
    queryKey: ['runtime-events-config', selectedTenant],
    queryFn: () => api.pluginRuntime.events.getConfig(selectedTenant).then((r) => r.data),
    enabled: !!selectedTenant,
  });

  const createMutation = useMutation({
    mutationFn: () => api.pluginRuntime.events.create(selectedTenant, guildId, {
      title,
      startAt,
      endAt,
      channelId,
      createdBy: creatorUserId,
      maxParticipants: configForm.default_max_participants,
    }),
    onSuccess: async () => {
      setMessage('活动创建成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-events-list', selectedTenant, guildId] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const joinMutation = useMutation({
    mutationFn: (eventId: number) => api.pluginRuntime.events.join(
      selectedTenant,
      eventId,
      { guildId, userId: joinUserId },
      makeIdempotencyKey(`events-join-${selectedTenant}-${eventId}-${joinUserId}`),
    ),
    onSuccess: async () => {
      setMessage('报名请求已提交');
      await queryClient.invalidateQueries({ queryKey: ['runtime-events-list', selectedTenant, guildId] });
      if (selectedEventId) {
        await queryClient.invalidateQueries({ queryKey: ['runtime-events-participants', selectedTenant, selectedEventId] });
      }
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const closeMutation = useMutation({
    mutationFn: (eventId: number) => api.pluginRuntime.events.close(
      selectedTenant,
      eventId,
      makeIdempotencyKey(`events-close-${selectedTenant}-${eventId}`),
    ),
    onSuccess: async () => {
      setMessage('活动关闭成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-events-list', selectedTenant, guildId] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const cancelJoinMutation = useMutation({
    mutationFn: (eventId: number) => api.pluginRuntime.events.cancel(selectedTenant, eventId, { guildId, userId: joinUserId }),
    onSuccess: async () => {
      setMessage('取消报名成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-events-list', selectedTenant, guildId] });
      if (selectedEventId) {
        await queryClient.invalidateQueries({ queryKey: ['runtime-events-participants', selectedTenant, selectedEventId] });
      }
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const saveConfigMutation = useMutation({
    mutationFn: () => api.pluginRuntime.events.saveConfig(selectedTenant, { ...configForm }),
    onSuccess: async () => {
      setMessage('活动配置保存成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-events-config', selectedTenant] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const eventRows = Array.isArray((listQuery.data as any)?.rows) ? (listQuery.data as any).rows : [];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{pageTitle}</h2>

      <div className="card text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-800">用法说明</p>
        <p>1) 先选租户并填写 Guild/频道/创建者，再创建活动。</p>
        <p>2) 在下方列表对同一活动做报名、取消报名或关闭。</p>
        <p>3) 点击“查看参与者”核对参与名单与状态。</p>
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
          <input className="input-field" value={creatorUserId} onChange={(e) => setCreatorUserId(e.target.value)} />
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">活动配置</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">reminder_before_minutes</label>
            <input className="input-field" type="number" min={1} value={configForm.reminder_before_minutes} onChange={(e) => setConfigForm((prev) => ({ ...prev, reminder_before_minutes: Math.max(1, Number(e.target.value) || 1) }))} />
            <p className="text-xs text-gray-400 mt-1">活动开始前多少分钟发送提醒</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">default_max_participants</label>
            <input className="input-field" type="number" min={0} value={configForm.default_max_participants} onChange={(e) => setConfigForm((prev) => ({ ...prev, default_max_participants: Math.max(0, Number(e.target.value) || 0) }))} />
            <p className="text-xs text-gray-400 mt-1">默认人数上限，0 表示不限制</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={configQuery.isLoading} onClick={() => {
            const raw = (configQuery.data as any) || {};
            setConfigForm({
              reminder_before_minutes: Number(raw.reminder_before_minutes ?? 30),
              default_max_participants: Number(raw.default_max_participants ?? 0),
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
        <h3 className="font-semibold">创建活动</h3>
        <input className="input-field" placeholder="活动标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="input-field" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          <input className="input-field" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </div>
        <button className="btn-primary" disabled={!selectedTenant || !guildId || !channelId || !creatorUserId || !title || !startAt || !endAt || createMutation.isPending} onClick={() => createMutation.mutate()}>
          {createMutation.isPending ? '创建中...' : '创建活动'}
        </button>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">报名 / 取消 / 关闭 / 参与者</h3>
        <input className="input-field" placeholder="用户 userId" value={joinUserId} onChange={(e) => setJoinUserId(e.target.value)} />
        {eventRows.length > 0 ? (
          <div className="space-y-2">
            {eventRows.map((row: any) => (
              <div key={row.id} className="border border-gray-200 rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">#{row.id} {row.title}</p>
                  <button className="btn-secondary" onClick={() => setSelectedEventId(row.id)}>查看参与者</button>
                </div>
                <p className="text-xs text-gray-500">status: {row.status} / max: {row.maxParticipants ?? 0}</p>
                <div className="flex gap-2">
                  <button className="btn-secondary" disabled={!joinUserId || joinMutation.isPending} onClick={() => joinMutation.mutate(row.id)}>报名</button>
                  <button className="btn-secondary" disabled={!joinUserId || cancelJoinMutation.isPending} onClick={() => cancelJoinMutation.mutate(row.id)}>取消报名</button>
                  <button className="btn-danger" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate(row.id)}>关闭活动</button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">暂无活动</p>}

        {selectedEventId ? (
          <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto">{JSON.stringify(participantsQuery.data || [], null, 2)}</pre>
        ) : null}
      </div>

      {message ? <div className="card text-sm text-gray-700">{message}</div> : null}
    </div>
  );
}
