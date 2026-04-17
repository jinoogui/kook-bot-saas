import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { getErrorText, makeIdempotencyKey, useRuntimeHeader, useRuntimeTenant } from '../runtimeUtils';

interface PollsConfigForm {
  default_duration_minutes: number;
  default_allow_multi: boolean;
}

export default function PollsRuntimePage() {
  const location = useLocation();
  const stateTenantId = (location.state as { tenantId?: string } | undefined)?.tenantId;
  const queryClient = useQueryClient();
  const { selectedTenant, setSelectedTenant, tenants } = useRuntimeTenant(stateTenantId);

  const [guildId, setGuildId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [voteUserId, setVoteUserId] = useState('');
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState('选项A\n选项B');
  const [voteOption, setVoteOption] = useState('opt1');
  const [selectedPollId, setSelectedPollId] = useState<number | null>(null);
  const [configForm, setConfigForm] = useState<PollsConfigForm>({
    default_duration_minutes: 30,
    default_allow_multi: false,
  });
  const [message, setMessage] = useState('');

  const tenantName = useMemo(() => tenants.find((t) => t.id === selectedTenant)?.name, [tenants, selectedTenant]);
  const pageTitle = useRuntimeHeader('Polls', selectedTenant, tenantName);

  const listQuery = useQuery({
    queryKey: ['runtime-polls-list', selectedTenant, guildId],
    queryFn: () => api.pluginRuntime.polls.list(selectedTenant, guildId).then((r) => r.data),
    enabled: !!selectedTenant && !!guildId,
  });

  const resultQuery = useQuery({
    queryKey: ['runtime-polls-result', selectedTenant, selectedPollId],
    queryFn: () => api.pluginRuntime.polls.result(selectedTenant, selectedPollId as number).then((r) => r.data),
    enabled: !!selectedTenant && !!selectedPollId,
  });

  const configQuery = useQuery({
    queryKey: ['runtime-polls-config', selectedTenant],
    queryFn: () => api.pluginRuntime.polls.getConfig(selectedTenant).then((r) => r.data),
    enabled: !!selectedTenant,
  });

  const createMutation = useMutation({
    mutationFn: () => api.pluginRuntime.polls.create(selectedTenant, guildId, {
      title,
      channelId,
      createdBy,
      allowMulti: configForm.default_allow_multi,
      options: options.split('\n').map((x) => x.trim()).filter(Boolean),
    }),
    onSuccess: async () => {
      setMessage('投票创建成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-polls-list', selectedTenant, guildId] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const voteMutation = useMutation({
    mutationFn: (id: number) => api.pluginRuntime.polls.vote(
      selectedTenant,
      id,
      { guildId, userId: voteUserId, optionKeys: [voteOption] },
      makeIdempotencyKey(`poll-vote-${selectedTenant}-${id}-${voteUserId}-${voteOption}`),
    ),
    onSuccess: async () => {
      setMessage('投票提交成功');
      if (selectedPollId) {
        await queryClient.invalidateQueries({ queryKey: ['runtime-polls-result', selectedTenant, selectedPollId] });
      }
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const closeMutation = useMutation({
    mutationFn: (id: number) => api.pluginRuntime.polls.close(
      selectedTenant,
      id,
      makeIdempotencyKey(`poll-close-${selectedTenant}-${id}`),
    ),
    onSuccess: async () => {
      setMessage('投票关闭成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-polls-list', selectedTenant, guildId] });
      if (selectedPollId) {
        await queryClient.invalidateQueries({ queryKey: ['runtime-polls-result', selectedTenant, selectedPollId] });
      }
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const saveConfigMutation = useMutation({
    mutationFn: () => api.pluginRuntime.polls.saveConfig(selectedTenant, { ...configForm }),
    onSuccess: async () => {
      setMessage('投票配置保存成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-polls-config', selectedTenant] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const pollRows = Array.isArray((listQuery.data as any)?.rows) ? (listQuery.data as any).rows : [];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{pageTitle}</h2>

      <div className="card text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-800">用法说明</p>
        <p>1) 先填租户、Guild、频道、创建者并创建投票。</p>
        <p>2) 在“投票/结果/关闭”区按投票 ID 执行投票和关闭。</p>
        <p>3) 点击“查看结果”核对统计是否符合预期。</p>
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
        <h3 className="font-semibold">投票配置</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">default_duration_minutes</label>
            <input className="input-field" type="number" min={1} value={configForm.default_duration_minutes} onChange={(e) => setConfigForm((prev) => ({ ...prev, default_duration_minutes: Math.max(1, Number(e.target.value) || 1) }))} />
            <p className="text-xs text-gray-400 mt-1">默认投票时长（分钟）</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">default_allow_multi</label>
            <select className="input-field" value={configForm.default_allow_multi ? 'true' : 'false'} onChange={(e) => setConfigForm((prev) => ({ ...prev, default_allow_multi: e.target.value === 'true' }))}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">默认是否允许多选</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={configQuery.isLoading} onClick={() => {
            const raw = (configQuery.data as any) || {};
            setConfigForm({
              default_duration_minutes: Number(raw.default_duration_minutes ?? 30),
              default_allow_multi: raw.default_allow_multi === true,
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
        <h3 className="font-semibold">创建投票</h3>
        <input className="input-field" placeholder="投票标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input-field" rows={4} value={options} onChange={(e) => setOptions(e.target.value)} />
        <button className="btn-primary" disabled={!selectedTenant || !guildId || !channelId || !createdBy || !title || createMutation.isPending} onClick={() => createMutation.mutate()}>
          {createMutation.isPending ? '创建中...' : '创建投票'}
        </button>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">投票 / 结果 / 关闭</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="input-field" placeholder="投票用户 userId" value={voteUserId} onChange={(e) => setVoteUserId(e.target.value)} />
          <input className="input-field" placeholder="投票选项 key (opt1/opt2...)" value={voteOption} onChange={(e) => setVoteOption(e.target.value)} />
        </div>

        {pollRows.length > 0 ? (
          <div className="space-y-2">
            {pollRows.map((row: any) => (
              <div key={row.id} className="border border-gray-200 rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">#{row.id} {row.title}</p>
                  <button className="btn-secondary" onClick={() => setSelectedPollId(row.id)}>查看结果</button>
                </div>
                <p className="text-xs text-gray-500">status: {row.status}</p>
                <div className="flex gap-2">
                  <button className="btn-secondary" disabled={!voteUserId || !voteOption || voteMutation.isPending} onClick={() => voteMutation.mutate(row.id)}>投票</button>
                  <button className="btn-danger" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate(row.id)}>关闭投票</button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">暂无投票</p>}

        {selectedPollId ? (
          <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto">{JSON.stringify(resultQuery.data || {}, null, 2)}</pre>
        ) : null}
      </div>

      {message ? <div className="card text-sm text-gray-700">{message}</div> : null}
    </div>
  );
}
