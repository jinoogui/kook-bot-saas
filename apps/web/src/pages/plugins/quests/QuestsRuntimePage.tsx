import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { getErrorText, makeIdempotencyKey, useRuntimeHeader, useRuntimeTenant } from '../runtimeUtils';

interface QuestsConfigForm {
  enabled: boolean;
  auto_claim: boolean;
  daily_reset_hour: number;
  message_quest_code: string;
}

export default function QuestsRuntimePage() {
  const location = useLocation();
  const stateTenantId = (location.state as { tenantId?: string } | undefined)?.tenantId;
  const queryClient = useQueryClient();
  const { selectedTenant, setSelectedTenant, tenants } = useRuntimeTenant(stateTenantId);

  const [guildId, setGuildId] = useState('');
  const [userId, setUserId] = useState('');
  const [code, setCode] = useState('daily_msg');
  const [title, setTitle] = useState('每日发言');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [configForm, setConfigForm] = useState<QuestsConfigForm>({
    enabled: true,
    auto_claim: false,
    daily_reset_hour: 4,
    message_quest_code: '',
  });

  const tenantName = useMemo(() => tenants.find((t) => t.id === selectedTenant)?.name, [tenants, selectedTenant]);
  const pageTitle = useRuntimeHeader('Quests', selectedTenant, tenantName);

  const templatesQuery = useQuery({
    queryKey: ['runtime-quests-templates', selectedTenant, guildId],
    queryFn: () => api.pluginRuntime.quests.templates(selectedTenant, guildId).then((r) => r.data),
    enabled: !!selectedTenant && !!guildId,
  });

  const progressQuery = useQuery({
    queryKey: ['runtime-quests-progress', selectedTenant, guildId, userId],
    queryFn: () => api.pluginRuntime.quests.userProgress(selectedTenant, guildId, userId).then((r) => r.data),
    enabled: !!selectedTenant && !!guildId && !!userId,
  });

  const leaderboardQuery = useQuery({
    queryKey: ['runtime-quests-leaderboard', selectedTenant, guildId],
    queryFn: () => api.pluginRuntime.quests.leaderboard(selectedTenant, guildId, { limit: 20 }).then((r) => r.data),
    enabled: !!selectedTenant && !!guildId,
  });

  const configQuery = useQuery({
    queryKey: ['runtime-quests-config', selectedTenant],
    queryFn: () => api.pluginRuntime.quests.getConfig(selectedTenant).then((r) => r.data),
    enabled: !!selectedTenant,
  });

  const createTemplateMutation = useMutation({
    mutationFn: () => api.pluginRuntime.quests.createTemplate(selectedTenant, guildId, {
      code,
      title,
      targetCount: 1,
      rewardPoints: 5,
      enabled: true,
    }),
    onSuccess: async () => {
      setMessage('模板创建成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-quests-templates', selectedTenant, guildId] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const toggleTemplateMutation = useMutation({
    mutationFn: (input: { id: number; enabled: boolean }) => api.pluginRuntime.quests.setTemplateEnabled(selectedTenant, input.id, { enabled: input.enabled }),
    onSuccess: async () => {
      setMessage('模板状态更新成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-quests-templates', selectedTenant, guildId] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const incrementMutation = useMutation({
    mutationFn: () => api.pluginRuntime.quests.increment(selectedTenant, guildId, userId, code, { amount: 1 }),
    onSuccess: async () => {
      setMessage('进度增加成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-quests-progress', selectedTenant, guildId, userId] });
      await queryClient.invalidateQueries({ queryKey: ['runtime-quests-leaderboard', selectedTenant, guildId] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const claimMutation = useMutation({
    mutationFn: () => api.pluginRuntime.quests.claim(
      selectedTenant,
      guildId,
      userId,
      code,
      {},
      makeIdempotencyKey(`quests-claim-${selectedTenant}-${guildId}-${userId}-${code}`),
    ),
    onSuccess: async () => {
      setMessage('领奖请求已提交');
      await queryClient.invalidateQueries({ queryKey: ['runtime-quests-progress', selectedTenant, guildId, userId] });
      await queryClient.invalidateQueries({ queryKey: ['runtime-quests-leaderboard', selectedTenant, guildId] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const saveConfigMutation = useMutation({
    mutationFn: () => api.pluginRuntime.quests.saveConfig(selectedTenant, { ...configForm }),
    onSuccess: async () => {
      setMessage('任务配置保存成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-quests-config', selectedTenant] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const templates = Array.isArray(templatesQuery.data) ? templatesQuery.data : [];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{pageTitle}</h2>

      <div className="card text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-800">用法说明</p>
        <p>1) 先选择租户和 Guild，创建或启用任务模板。</p>
        <p>2) 填写 User ID 后执行“增加进度/领取奖励”。</p>
        <p>3) 通过“用户进度”和“排行榜”验证任务链路。</p>
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
          <label className="text-sm text-gray-600">User ID</label>
          <input className="input-field" value={userId} onChange={(e) => setUserId(e.target.value)} />
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">任务配置</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500">enabled</label>
            <select className="input-field" value={configForm.enabled ? 'true' : 'false'} onChange={(e) => setConfigForm((prev) => ({ ...prev, enabled: e.target.value === 'true' }))}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">auto_claim</label>
            <select className="input-field" value={configForm.auto_claim ? 'true' : 'false'} onChange={(e) => setConfigForm((prev) => ({ ...prev, auto_claim: e.target.value === 'true' }))}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">daily_reset_hour</label>
            <input className="input-field" type="number" min={0} max={23} value={configForm.daily_reset_hour} onChange={(e) => setConfigForm((prev) => ({ ...prev, daily_reset_hour: Math.min(23, Math.max(0, Number(e.target.value) || 0)) }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500">message_quest_code</label>
            <input className="input-field" value={configForm.message_quest_code} onChange={(e) => setConfigForm((prev) => ({ ...prev, message_quest_code: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={configQuery.isLoading} onClick={() => {
            const raw = (configQuery.data as any) || {};
            setConfigForm({
              enabled: raw.enabled !== false,
              auto_claim: raw.auto_claim === true,
              daily_reset_hour: Number(raw.daily_reset_hour ?? 4),
              message_quest_code: String(raw.message_quest_code || ''),
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
        <h3 className="font-semibold">模板管理</h3>
        <input className="input-field" value={code} onChange={(e) => setCode(e.target.value)} placeholder="quest code" />
        <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="quest title" />
        <button className="btn-primary" disabled={!selectedTenant || !guildId || !code || !title || createTemplateMutation.isPending} onClick={() => createTemplateMutation.mutate()}>
          {createTemplateMutation.isPending ? '创建中...' : '创建模板'}
        </button>

        {templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((item: any) => (
              <div key={item.id} className="border border-gray-200 rounded p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.code} - {item.title}</p>
                  <p className="text-xs text-gray-500">enabled: {item.enabled === 1 ? 'true' : 'false'}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => setSelectedTemplateId(item.id)}>选中</button>
                  <button className="btn-secondary" disabled={toggleTemplateMutation.isPending} onClick={() => toggleTemplateMutation.mutate({ id: item.id, enabled: item.enabled !== 1 })}>
                    {item.enabled === 1 ? '禁用' : '启用'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">暂无模板</p>}
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">进度 / 领奖 / 排行</h3>
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={!selectedTenant || !guildId || !userId || incrementMutation.isPending} onClick={() => incrementMutation.mutate()}>
            增加进度
          </button>
          <button className="btn-primary" disabled={!selectedTenant || !guildId || !userId || claimMutation.isPending} onClick={() => claimMutation.mutate()}>
            领取奖励
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium mb-1">用户进度</p>
            <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto">{JSON.stringify(progressQuery.data || [], null, 2)}</pre>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">排行榜</p>
            <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto">{JSON.stringify(leaderboardQuery.data || [], null, 2)}</pre>
          </div>
        </div>
      </div>

      {selectedTemplateId ? <p className="text-xs text-gray-500">当前选中模板 ID: {selectedTemplateId}</p> : null}
      {message ? <div className="card text-sm text-gray-700">{message}</div> : null}
    </div>
  );
}
