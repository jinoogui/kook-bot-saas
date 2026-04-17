import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { getErrorText, makeIdempotencyKey, useRuntimeHeader, useRuntimeTenant } from '../runtimeUtils';

interface RaffleConfigForm {
  default_duration_minutes: number;
  prevent_repeat_join: boolean;
}

export default function RaffleRuntimePage() {
  const location = useLocation();
  const stateTenantId = (location.state as { tenantId?: string } | undefined)?.tenantId;
  const queryClient = useQueryClient();
  const { selectedTenant, setSelectedTenant, tenants } = useRuntimeTenant(stateTenantId);

  const [guildId, setGuildId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [joinUserId, setJoinUserId] = useState('');
  const [title, setTitle] = useState('');
  const [prize, setPrize] = useState('');
  const [drawAt, setDrawAt] = useState('');
  const [selectedRaffleId, setSelectedRaffleId] = useState<number | null>(null);
  const [configForm, setConfigForm] = useState<RaffleConfigForm>({
    default_duration_minutes: 30,
    prevent_repeat_join: true,
  });
  const [message, setMessage] = useState('');

  const tenantName = useMemo(() => tenants.find((t) => t.id === selectedTenant)?.name, [tenants, selectedTenant]);
  const pageTitle = useRuntimeHeader('Raffle', selectedTenant, tenantName);

  const listQuery = useQuery({
    queryKey: ['runtime-raffle-list', selectedTenant, guildId],
    queryFn: () => api.pluginRuntime.raffle.list(selectedTenant, guildId).then((r) => r.data),
    enabled: !!selectedTenant && !!guildId,
  });

  const participantsQuery = useQuery({
    queryKey: ['runtime-raffle-participants', selectedTenant, selectedRaffleId],
    queryFn: () => api.pluginRuntime.raffle.participants(selectedTenant, selectedRaffleId as number).then((r) => r.data),
    enabled: !!selectedTenant && !!selectedRaffleId,
  });

  const configQuery = useQuery({
    queryKey: ['runtime-raffle-config', selectedTenant],
    queryFn: () => api.pluginRuntime.raffle.getConfig(selectedTenant).then((r) => r.data),
    enabled: !!selectedTenant,
  });

  const createMutation = useMutation({
    mutationFn: () => api.pluginRuntime.raffle.create(selectedTenant, guildId, {
      title,
      prize,
      drawAt,
      channelId,
      createdBy,
    }),
    onSuccess: async () => {
      setMessage('抽奖创建成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-raffle-list', selectedTenant, guildId] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const joinMutation = useMutation({
    mutationFn: (id: number) => api.pluginRuntime.raffle.join(
      selectedTenant,
      id,
      { guildId, userId: joinUserId },
      makeIdempotencyKey(`raffle-join-${selectedTenant}-${id}-${joinUserId}`),
    ),
    onSuccess: async () => {
      setMessage('参与请求已提交');
      await queryClient.invalidateQueries({ queryKey: ['runtime-raffle-list', selectedTenant, guildId] });
      if (selectedRaffleId) {
        await queryClient.invalidateQueries({ queryKey: ['runtime-raffle-participants', selectedTenant, selectedRaffleId] });
      }
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const drawMutation = useMutation({
    mutationFn: (id: number) => api.pluginRuntime.raffle.draw(
      selectedTenant,
      id,
      makeIdempotencyKey(`raffle-draw-${selectedTenant}-${id}`),
    ),
    onSuccess: async (res: any) => {
      const data = res?.data;
      if (data?.winnerUserId) {
        setMessage(`开奖完成，中奖用户: ${data.winnerUserId}`);
      } else {
        setMessage(data?.message || '开奖请求已提交');
      }
      await queryClient.invalidateQueries({ queryKey: ['runtime-raffle-list', selectedTenant, guildId] });
      if (selectedRaffleId) {
        await queryClient.invalidateQueries({ queryKey: ['runtime-raffle-participants', selectedTenant, selectedRaffleId] });
      }
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const saveConfigMutation = useMutation({
    mutationFn: () => api.pluginRuntime.raffle.saveConfig(selectedTenant, { ...configForm }),
    onSuccess: async () => {
      setMessage('抽奖配置保存成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-raffle-config', selectedTenant] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const raffleRows = Array.isArray((listQuery.data as any)?.rows) ? (listQuery.data as any).rows : [];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{pageTitle}</h2>

      <div className="card text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-800">用法说明</p>
        <p>1) 先填写租户、Guild、频道、创建者后创建抽奖。</p>
        <p>2) 在列表中让用户参与，再执行开奖。</p>
        <p>3) 点击“查看参与者”确认参与池与开奖前数据。</p>
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
        <h3 className="font-semibold">抽奖配置</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">default_duration_minutes</label>
            <input className="input-field" type="number" min={1} value={configForm.default_duration_minutes} onChange={(e) => setConfigForm((prev) => ({ ...prev, default_duration_minutes: Math.max(1, Number(e.target.value) || 1) }))} />
            <p className="text-xs text-gray-400 mt-1">创建抽奖时默认持续分钟数</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">prevent_repeat_join</label>
            <select className="input-field" value={configForm.prevent_repeat_join ? 'true' : 'false'} onChange={(e) => setConfigForm((prev) => ({ ...prev, prevent_repeat_join: e.target.value === 'true' }))}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">是否防止同一用户重复参与</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={configQuery.isLoading} onClick={() => {
            const raw = (configQuery.data as any) || {};
            setConfigForm({
              default_duration_minutes: Number(raw.default_duration_minutes ?? 30),
              prevent_repeat_join: raw.prevent_repeat_join !== false,
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
        <h3 className="font-semibold">创建抽奖</h3>
        <input className="input-field" placeholder="抽奖标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="input-field" placeholder="奖品" value={prize} onChange={(e) => setPrize(e.target.value)} />
        <input className="input-field" type="datetime-local" value={drawAt} onChange={(e) => setDrawAt(e.target.value)} />
        <button className="btn-primary" disabled={!selectedTenant || !guildId || !channelId || !createdBy || !title || !prize || !drawAt || createMutation.isPending} onClick={() => createMutation.mutate()}>
          {createMutation.isPending ? '创建中...' : '创建抽奖'}
        </button>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">参与 / 开奖 / 参与者</h3>
        <input className="input-field" placeholder="参与者 userId" value={joinUserId} onChange={(e) => setJoinUserId(e.target.value)} />
        {raffleRows.length > 0 ? (
          <div className="space-y-2">
            {raffleRows.map((row: any) => (
              <div key={row.id} className="border border-gray-200 rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">#{row.id} {row.title}</p>
                  <button className="btn-secondary" onClick={() => setSelectedRaffleId(row.id)}>查看参与者</button>
                </div>
                <p className="text-xs text-gray-500">status: {row.status}</p>
                <div className="flex gap-2">
                  <button className="btn-secondary" disabled={!joinUserId || joinMutation.isPending} onClick={() => joinMutation.mutate(row.id)}>参与</button>
                  <button className="btn-danger" disabled={drawMutation.isPending} onClick={() => drawMutation.mutate(row.id)}>开奖</button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">暂无抽奖</p>}

        {selectedRaffleId ? (
          <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto">{JSON.stringify(participantsQuery.data || [], null, 2)}</pre>
        ) : null}
      </div>

      {message ? <div className="card text-sm text-gray-700">{message}</div> : null}
    </div>
  );
}
