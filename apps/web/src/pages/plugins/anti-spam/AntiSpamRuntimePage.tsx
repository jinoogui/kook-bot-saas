import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { getErrorText, useRuntimeHeader, useRuntimeTenant } from '../runtimeUtils';

interface AntiSpamConfigForm {
  enabled: boolean;
  default_action: 'warn' | 'mute' | 'delete';
  default_window_seconds: number;
  default_max_messages: number;
  default_duplicate_threshold: number;
  default_block_at_all: boolean;
  default_mute_hours: number;
}

export default function AntiSpamRuntimePage() {
  const location = useLocation();
  const stateTenantId = (location.state as { tenantId?: string } | undefined)?.tenantId;
  const queryClient = useQueryClient();
  const { selectedTenant, setSelectedTenant, tenants } = useRuntimeTenant(stateTenantId);

  const [guildId, setGuildId] = useState('');
  const [whitelistUserId, setWhitelistUserId] = useState('');
  const [message, setMessage] = useState('');
  const [configForm, setConfigForm] = useState<AntiSpamConfigForm>({
    enabled: true,
    default_action: 'warn',
    default_window_seconds: 10,
    default_max_messages: 6,
    default_duplicate_threshold: 3,
    default_block_at_all: true,
    default_mute_hours: 1,
  });

  const tenantName = useMemo(() => tenants.find((t) => t.id === selectedTenant)?.name, [tenants, selectedTenant]);
  const pageTitle = useRuntimeHeader('Anti-Spam', selectedTenant, tenantName);

  const ruleQuery = useQuery({
    queryKey: ['runtime-anti-spam-rule', selectedTenant, guildId],
    queryFn: () => api.pluginRuntime.antiSpam.getRule(selectedTenant, guildId).then((r) => r.data),
    enabled: !!selectedTenant && !!guildId,
  });

  const configQuery = useQuery({
    queryKey: ['runtime-anti-spam-config', selectedTenant],
    queryFn: () => api.pluginRuntime.antiSpam.getConfig(selectedTenant).then((r) => r.data),
    enabled: !!selectedTenant,
  });

  const violationsQuery = useQuery({
    queryKey: ['runtime-anti-spam-violations', selectedTenant, guildId],
    queryFn: () => api.pluginRuntime.antiSpam.listViolations(selectedTenant, guildId).then((r) => r.data),
    enabled: !!selectedTenant && !!guildId,
  });

  const whitelistQuery = useQuery({
    queryKey: ['runtime-anti-spam-whitelist', selectedTenant, guildId],
    queryFn: () => api.pluginRuntime.antiSpam.listWhitelist(selectedTenant, guildId).then((r) => r.data),
    enabled: !!selectedTenant && !!guildId,
  });

  const updateRuleMutation = useMutation({
    mutationFn: () => api.pluginRuntime.antiSpam.updateRule(selectedTenant, guildId, {
      enabled: configForm.enabled,
      actionType: configForm.default_action,
      maxMessagesPerWindow: configForm.default_max_messages,
      windowSeconds: configForm.default_window_seconds,
      duplicateThreshold: configForm.default_duplicate_threshold,
      blockAtAll: configForm.default_block_at_all,
      muteHours: configForm.default_mute_hours,
    }),
    onSuccess: async () => {
      setMessage('规则更新成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-anti-spam-rule', selectedTenant, guildId] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const saveConfigMutation = useMutation({
    mutationFn: () => api.pluginRuntime.antiSpam.saveConfig(selectedTenant, { ...configForm }),
    onSuccess: async () => {
      setMessage('防刷配置保存成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-anti-spam-config', selectedTenant] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const addWhitelistMutation = useMutation({
    mutationFn: () => api.pluginRuntime.antiSpam.addWhitelist(selectedTenant, guildId, { userId: whitelistUserId }),
    onSuccess: async () => {
      setMessage('白名单添加成功');
      setWhitelistUserId('');
      await queryClient.invalidateQueries({ queryKey: ['runtime-anti-spam-whitelist', selectedTenant, guildId] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const removeWhitelistMutation = useMutation({
    mutationFn: (userId: string) => api.pluginRuntime.antiSpam.removeWhitelist(selectedTenant, guildId, userId),
    onSuccess: async () => {
      setMessage('白名单移除成功');
      await queryClient.invalidateQueries({ queryKey: ['runtime-anti-spam-whitelist', selectedTenant, guildId] });
    },
    onError: (err) => setMessage(getErrorText(err)),
  });

  const ruleData = (ruleQuery.data as any) || {};
  const configData = (configQuery.data as any) || {};
  const violations = (violationsQuery.data as any)?.rows || [];
  const whitelist = Array.isArray(whitelistQuery.data) ? whitelistQuery.data : [];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{pageTitle}</h2>

      <div className="card text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-800">用法说明</p>
        <p>1) 先选租户和 Guild，再加载配置并调整规则参数。</p>
        <p>2) 保存全局配置后，点击“应用到当前 Guild 规则”。</p>
        <p>3) 通过白名单和违规记录联动验证规则是否生效。</p>
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-2 gap-3">
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
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">防刷配置</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500">enabled</label>
            <select className="input-field" value={configForm.enabled ? 'true' : 'false'} onChange={(e) => setConfigForm((prev) => ({ ...prev, enabled: e.target.value === 'true' }))}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">default_action</label>
            <select className="input-field" value={configForm.default_action} onChange={(e) => setConfigForm((prev) => ({ ...prev, default_action: e.target.value as AntiSpamConfigForm['default_action'] }))}>
              <option value="warn">warn</option>
              <option value="mute">mute</option>
              <option value="delete">delete</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">window_seconds</label>
            <input className="input-field" type="number" min={3} max={120} value={configForm.default_window_seconds} onChange={(e) => setConfigForm((prev) => ({ ...prev, default_window_seconds: Math.min(120, Math.max(3, Number(e.target.value) || 3)) }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500">max_messages</label>
            <input className="input-field" type="number" min={2} max={30} value={configForm.default_max_messages} onChange={(e) => setConfigForm((prev) => ({ ...prev, default_max_messages: Math.min(30, Math.max(2, Number(e.target.value) || 2)) }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500">duplicate_threshold</label>
            <input className="input-field" type="number" min={2} max={20} value={configForm.default_duplicate_threshold} onChange={(e) => setConfigForm((prev) => ({ ...prev, default_duplicate_threshold: Math.min(20, Math.max(2, Number(e.target.value) || 2)) }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500">block_at_all</label>
            <select className="input-field" value={configForm.default_block_at_all ? 'true' : 'false'} onChange={(e) => setConfigForm((prev) => ({ ...prev, default_block_at_all: e.target.value === 'true' }))}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">mute_hours</label>
            <input className="input-field" type="number" min={1} max={168} value={configForm.default_mute_hours} onChange={(e) => setConfigForm((prev) => ({ ...prev, default_mute_hours: Math.min(168, Math.max(1, Number(e.target.value) || 1)) }))} />
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-secondary" disabled={configQuery.isLoading} onClick={() => {
            setConfigForm({
              enabled: configData.enabled !== false,
              default_action: (configData.default_action || 'warn') as AntiSpamConfigForm['default_action'],
              default_window_seconds: Number(configData.default_window_seconds ?? 10),
              default_max_messages: Number(configData.default_max_messages ?? 6),
              default_duplicate_threshold: Number(configData.default_duplicate_threshold ?? 3),
              default_block_at_all: configData.default_block_at_all !== false,
              default_mute_hours: Number(configData.default_mute_hours ?? 1),
            });
          }}>
            从服务端加载
          </button>
          <button className="btn-primary" disabled={!selectedTenant || saveConfigMutation.isPending} onClick={() => saveConfigMutation.mutate()}>
            {saveConfigMutation.isPending ? '保存中...' : '保存配置'}
          </button>
          <button className="btn-secondary" disabled={!selectedTenant || !guildId || updateRuleMutation.isPending} onClick={() => updateRuleMutation.mutate()}>
            {updateRuleMutation.isPending ? '应用中...' : '应用到当前 Guild 规则'}
          </button>
        </div>

        <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto">{JSON.stringify(ruleData, null, 2)}</pre>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">白名单管理</h3>
        <div className="flex gap-2">
          <input className="input-field" placeholder="userId" value={whitelistUserId} onChange={(e) => setWhitelistUserId(e.target.value)} />
          <button className="btn-secondary" disabled={!whitelistUserId || addWhitelistMutation.isPending} onClick={() => addWhitelistMutation.mutate()}>
            添加
          </button>
        </div>

        {whitelist.length > 0 ? (
          <div className="space-y-2">
            {whitelist.map((row: any) => (
              <div key={`${row.guildId}-${row.userId}`} className="border border-gray-200 rounded p-2 flex items-center justify-between">
                <span className="text-sm">{row.userId}</span>
                <button className="btn-danger" onClick={() => removeWhitelistMutation.mutate(row.userId)}>移除</button>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">暂无白名单</p>}
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold">违规记录</h3>
        <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto">{JSON.stringify(violations, null, 2)}</pre>
      </div>

      {message ? <div className="card text-sm text-gray-700">{message}</div> : null}
    </div>
  );
}
