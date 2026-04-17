import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export function useRuntimeTenant(initialTenantId?: string) {
  const [selectedTenant, setSelectedTenant] = useState(initialTenantId || '');

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.tenants.list().then((r) => r.data),
  });

  useEffect(() => {
    if (!selectedTenant && tenants?.length === 1) {
      setSelectedTenant(tenants[0].id);
    }
  }, [selectedTenant, tenants]);

  return {
    selectedTenant,
    setSelectedTenant,
    tenants: tenants || [],
  };
}

const CODE_HINT: Record<string, string> = {
  PLUGIN_NOT_SUBSCRIBED: '插件未订阅，请先在配置页订阅并激活。',
  PLUGIN_DISABLED: '插件已禁用，请先启用。',
  INSTANCE_NOT_RUNNING: '实例未运行，请先启动实例。',
  PLUGIN_ROUTE_NOT_FOUND: '插件运行时路由不存在，请检查插件版本。',
  PLUGIN_CONFIG_VALIDATION_FAILED: '配置校验失败，请检查字段。',
};

export function getErrorText(err: any): string {
  const code = err?.code || err?.response?.data?.code;
  const details = err?.response?.data?.details;
  const message = err?.message || err?.response?.data?.error || '请求失败';
  const hint = code ? CODE_HINT[code] : '';

  if (details?.issues && Array.isArray(details.issues) && details.issues.length > 0) {
    const text = details.issues
      .map((item: any) => `${item.path || '(root)'}: ${item.message}`)
      .join('；');
    return `${code ? `${code} - ` : ''}${message}；${text}`;
  }

  if (hint) {
    return `${code}: ${message}（${hint}）`;
  }

  return code ? `${code}: ${message}` : message;
}

export function useRuntimeHeader(pluginTitle: string, selectedTenant: string, tenantName?: string) {
  return useMemo(() => {
    const tenantLabel = tenantName ? `${tenantName} (${selectedTenant})` : selectedTenant || '未选择';
    return `${pluginTitle} Runtime · ${tenantLabel}`;
  }, [pluginTitle, selectedTenant, tenantName]);
}

export function makeIdempotencyKey(scope: string): string {
  return `${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
