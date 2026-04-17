import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    // 后端统一返回 { success: true, data: ... }，自动解包
    if (res.data && typeof res.data === 'object' && 'success' in res.data && 'data' in res.data) {
      res.data = res.data.data;
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Let React router handle the redirect via AuthContext
    }

    const payload = err.response?.data;
    if (payload && typeof payload === 'object') {
      err.code = (payload as any).code ?? err.code;
      err.message = (payload as any).error ?? (payload as any).message ?? err.message;
    }

    return Promise.reject(err);
  },
);

export interface User {
  id: string;
  email: string;
  username: string;
  role?: 'user' | 'admin';
}

export interface Tenant {
  id: string;
  name: string;
  botToken?: string;
  verifyToken?: string;
  encryptKey?: string;
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping';
  assignedPort?: number;
  lastHeartbeat?: string;
  createdAt: string;
  updatedAt?: string;
  hasToken?: boolean;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  tier: string;
  priceMonthly: number;
  priceYearly: number;
  enabled: number;
  config_schema?: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  tenantId: string;
  pluginId: string;
  pluginName?: string;
  planType: string;
  status: string;
  enabled: boolean;
  config: Record<string, unknown>;
  expiresAt?: string;
  startedAt?: string;
  createdAt: string;
}

export interface InstanceStatus {
  tenantId: string;
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping';
  uptime: number | null;
  lastHeartbeat: string | null;
  restartCount: number;
}

export interface InstanceDiagnosis {
  tenantId: string;
  tracked: boolean;
  status: 'running' | 'starting' | 'stopping' | 'error' | 'stopped';
  pid: number | null;
  lastHeartbeat: number | null;
  missingTables: string[];
  checks: {
    tenantTablesOk: boolean;
    processTracked: boolean;
  };
  recentErrors: InstanceLog[];
}

export interface InstanceLog {
  id: number;
  tenantId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: string;
  createdAt: string;
}

function toQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  const query = new URLSearchParams();
  if (!params) return '';
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  return query.toString();
}

export interface AuditLog {
  id: number;
  userId: number;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
  username?: string;
  email?: string;
}

export type PaymentRiskDecision = 'pass' | 'review' | 'reject';

export interface AdminStats {
  userCount: number;
  tenantCount: number;
  runningCount: number;
  totalRevenue: number;
  todayRevenue: number;
  pendingReviewCount: number;
  riskRejectCount: number;
  payConversion: number;
}

const auth = {
  register: (email: string, username: string, password: string) =>
    api.post('/auth/register', { email, username, password }),

  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  getMe: () => api.get('/auth/me'),
};

const tenants = {
  list: () => api.get<Tenant[]>('/tenants'),

  create: (data: { name: string; botToken: string; verifyToken?: string; encryptKey?: string }) =>
    api.post<Tenant>('/tenants', data),

  get: (id: string) => api.get<Tenant>(`/tenants/${id}`),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/tenants/${id}`, data),

  delete: (id: string) => api.delete(`/tenants/${id}`),
};

const instances = {
  start: (id: string) => api.post(`/instances/${id}/start`),

  stop: (id: string) => api.post(`/instances/${id}/stop`),

  restart: (id: string) => api.post(`/instances/${id}/restart`),

  status: (id: string) => api.get<InstanceStatus>(`/instances/${id}/status`),

  diagnose: (id: string) => api.get<InstanceDiagnosis>(`/instances/${id}/diagnose`),

  logs: (id: string, params?: { level?: string; search?: string; page?: number; size?: number }) => {
    const query = new URLSearchParams();
    if (params?.level) query.set('level', params.level);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.size) query.set('size', String(params.size));
    return api.get<{ rows: InstanceLog[]; total: number; page: number; size: number }>(
      `/instances/${id}/logs?${query.toString()}`
    );
  },
};

const plugins = {
  list: () => api.get<Plugin[]>('/plugins'),

  get: (id: string) => api.get<Plugin>(`/plugins/${id}`),
};

const subscriptions = {
  list: (tenantId: string) =>
    api.get<Subscription[]>(`/tenants/${tenantId}/subscriptions`).then((res) => {
      // Backend returns isEnabled (number) and configJson (string), normalize them
      if (Array.isArray(res.data)) {
        res.data = res.data.map((s: any) => ({
          ...s,
          enabled: s.enabled ?? (s.isEnabled === 1),
          config: s.config ?? (s.configJson ? JSON.parse(s.configJson) : {}),
        }));
      }
      return res;
    }),

  subscribe: (tenantId: string, pluginId: string, planType: string) =>
    api.post(`/tenants/${tenantId}/subscriptions`, {
      pluginId,
      planType,
    }),

  unsubscribe: (tenantId: string, pluginId: string) =>
    api.delete(`/tenants/${tenantId}/subscriptions/${pluginId}`),

  toggle: (tenantId: string, pluginId: string, enabled: boolean) =>
    api.patch(
      `/tenants/${tenantId}/subscriptions/${pluginId}/toggle`,
      { enabled },
    ),

  updateConfig: (tenantId: string, pluginId: string, config: Record<string, unknown>) =>
    api.put(`/tenants/${tenantId}/subscriptions/${pluginId}/config`, config),
};

const pluginRuntime = {
  request: (
    tenantId: string,
    pluginId: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    data?: Record<string, unknown>,
    params?: Record<string, string | number | boolean | undefined | null>,
    idempotencyKey?: string,
  ) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const query = toQuery(params);
    const url = `/tenants/${tenantId}/plugins/${pluginId}/runtime${normalizedPath}${query ? `?${query}` : ''}`;
    return api.request({
      method,
      url,
      data,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  },

  ticket: {
    list: (tenantId: string, guildId: string, params?: { status?: string; page?: number; size?: number }) =>
      pluginRuntime.request(tenantId, 'ticket', 'GET', `/tickets/${guildId}`, undefined, params),
    create: (tenantId: string, guildId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'ticket', 'POST', `/tickets/${guildId}`, data),
    detail: (tenantId: string, id: number) =>
      pluginRuntime.request(tenantId, 'ticket', 'GET', `/tickets/detail/${id}`),
    assign: (tenantId: string, id: number, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'ticket', 'POST', `/tickets/${id}/assign`, data),
    close: (tenantId: string, id: number, data: Record<string, unknown>, idempotencyKey?: string) =>
      pluginRuntime.request(tenantId, 'ticket', 'POST', `/tickets/${id}/close`, data, undefined, idempotencyKey),
    getConfig: (tenantId: string) =>
      pluginRuntime.request(tenantId, 'ticket', 'GET', '/config'),
    saveConfig: (tenantId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'ticket', 'POST', '/config', data),
  },

  events: {
    list: (tenantId: string, guildId: string, params?: { status?: string; page?: number; size?: number }) =>
      pluginRuntime.request(tenantId, 'events', 'GET', `/items/${guildId}`, undefined, params),
    create: (tenantId: string, guildId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'events', 'POST', `/items/${guildId}`, data),
    join: (tenantId: string, id: number, data: Record<string, unknown>, idempotencyKey?: string) =>
      pluginRuntime.request(tenantId, 'events', 'POST', `/items/${id}/join`, data, undefined, idempotencyKey),
    cancel: (tenantId: string, id: number, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'events', 'POST', `/items/${id}/cancel`, data),
    participants: (tenantId: string, id: number) =>
      pluginRuntime.request(tenantId, 'events', 'GET', `/items/${id}/participants`),
    close: (tenantId: string, id: number, idempotencyKey?: string) =>
      pluginRuntime.request(tenantId, 'events', 'POST', `/items/${id}/close`, {}, undefined, idempotencyKey),
    getConfig: (tenantId: string) =>
      pluginRuntime.request(tenantId, 'events', 'GET', '/config'),
    saveConfig: (tenantId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'events', 'POST', '/config', data),
  },

  raffle: {
    list: (tenantId: string, guildId: string, params?: { status?: string; page?: number; size?: number }) =>
      pluginRuntime.request(tenantId, 'raffle', 'GET', `/items/${guildId}`, undefined, params),
    create: (tenantId: string, guildId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'raffle', 'POST', `/items/${guildId}`, data),
    join: (tenantId: string, id: number, data: Record<string, unknown>, idempotencyKey?: string) =>
      pluginRuntime.request(tenantId, 'raffle', 'POST', `/items/${id}/join`, data, undefined, idempotencyKey),
    participants: (tenantId: string, id: number) =>
      pluginRuntime.request(tenantId, 'raffle', 'GET', `/items/${id}/participants`),
    draw: (tenantId: string, id: number, idempotencyKey?: string) =>
      pluginRuntime.request(tenantId, 'raffle', 'POST', `/items/${id}/draw`, {}, undefined, idempotencyKey),
    getConfig: (tenantId: string) =>
      pluginRuntime.request(tenantId, 'raffle', 'GET', '/config'),
    saveConfig: (tenantId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'raffle', 'POST', '/config', data),
  },

  polls: {
    list: (tenantId: string, guildId: string, params?: { status?: string; page?: number; size?: number }) =>
      pluginRuntime.request(tenantId, 'polls', 'GET', `/items/${guildId}`, undefined, params),
    create: (tenantId: string, guildId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'polls', 'POST', `/items/${guildId}`, data),
    vote: (tenantId: string, id: number, data: Record<string, unknown>, idempotencyKey?: string) =>
      pluginRuntime.request(tenantId, 'polls', 'POST', `/items/${id}/vote`, data, undefined, idempotencyKey),
    result: (tenantId: string, id: number) =>
      pluginRuntime.request(tenantId, 'polls', 'GET', `/items/${id}/result`),
    close: (tenantId: string, id: number, idempotencyKey?: string) =>
      pluginRuntime.request(tenantId, 'polls', 'POST', `/items/${id}/close`, {}, undefined, idempotencyKey),
    getConfig: (tenantId: string) =>
      pluginRuntime.request(tenantId, 'polls', 'GET', '/config'),
    saveConfig: (tenantId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'polls', 'POST', '/config', data),
  },

  quests: {
    templates: (tenantId: string, guildId: string) =>
      pluginRuntime.request(tenantId, 'quests', 'GET', `/templates/${guildId}`),
    createTemplate: (tenantId: string, guildId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'quests', 'POST', `/templates/${guildId}`, data),
    setTemplateEnabled: (tenantId: string, id: number, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'quests', 'PATCH', `/templates/${id}/enabled`, data),
    userProgress: (tenantId: string, guildId: string, userId: string, params?: { dateKey?: string }) =>
      pluginRuntime.request(tenantId, 'quests', 'GET', `/progress/${guildId}/${userId}`, undefined, params),
    increment: (tenantId: string, guildId: string, userId: string, questCode: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'quests', 'POST', `/progress/${guildId}/${userId}/${questCode}/increment`, data),
    claim: (tenantId: string, guildId: string, userId: string, questCode: string, data: Record<string, unknown>, idempotencyKey?: string) =>
      pluginRuntime.request(tenantId, 'quests', 'POST', `/progress/${guildId}/${userId}/${questCode}/claim`, data, undefined, idempotencyKey),
    leaderboard: (tenantId: string, guildId: string, params?: { dateKey?: string; limit?: number }) =>
      pluginRuntime.request(tenantId, 'quests', 'GET', `/leaderboard/${guildId}`, undefined, params),
    getConfig: (tenantId: string) =>
      pluginRuntime.request(tenantId, 'quests', 'GET', '/config'),
    saveConfig: (tenantId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'quests', 'POST', '/config', data),
  },

  announcer: {
    list: (tenantId: string, guildId: string, params?: { status?: string; page?: number; size?: number }) =>
      pluginRuntime.request(tenantId, 'announcer', 'GET', `/tasks/${guildId}`, undefined, params),
    create: (tenantId: string, guildId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'announcer', 'POST', `/tasks/${guildId}`, data),
    cancel: (tenantId: string, id: number, idempotencyKey?: string) =>
      pluginRuntime.request(tenantId, 'announcer', 'POST', `/tasks/${id}/cancel`, {}, undefined, idempotencyKey),
    sendNow: (tenantId: string, id: number, idempotencyKey?: string) =>
      pluginRuntime.request(tenantId, 'announcer', 'POST', `/tasks/${id}/send`, {}, undefined, idempotencyKey),
    getConfig: (tenantId: string) =>
      pluginRuntime.request(tenantId, 'announcer', 'GET', '/config'),
    saveConfig: (tenantId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'announcer', 'POST', '/config', data),
  },

  antiSpam: {
    getRule: (tenantId: string, guildId: string) =>
      pluginRuntime.request(tenantId, 'anti-spam', 'GET', `/rules/${guildId}`),
    updateRule: (tenantId: string, guildId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'anti-spam', 'PUT', `/rules/${guildId}`, data),
    listWhitelist: (tenantId: string, guildId: string) =>
      pluginRuntime.request(tenantId, 'anti-spam', 'GET', `/whitelist/${guildId}`),
    addWhitelist: (tenantId: string, guildId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'anti-spam', 'POST', `/whitelist/${guildId}`, data),
    removeWhitelist: (tenantId: string, guildId: string, userId: string) =>
      pluginRuntime.request(tenantId, 'anti-spam', 'DELETE', `/whitelist/${guildId}/${userId}`),
    listViolations: (tenantId: string, guildId: string, params?: { page?: number; size?: number }) =>
      pluginRuntime.request(tenantId, 'anti-spam', 'GET', `/violations/${guildId}`, undefined, params),
    getConfig: (tenantId: string) =>
      pluginRuntime.request(tenantId, 'anti-spam', 'GET', '/config'),
    saveConfig: (tenantId: string, data: Record<string, unknown>) =>
      pluginRuntime.request(tenantId, 'anti-spam', 'POST', '/config', data),
  },
};

const admin = {
  getStats: () => api.get<AdminStats>('/admin/stats'),
  getUsers: (params?: { page?: number; size?: number; role?: string; status?: string; keyword?: string; startDate?: string; endDate?: string }) =>
    api.get(`/admin/users?${toQuery(params)}`),
  updateUser: (id: number, data: { role?: string; status?: string }) =>
    api.patch(`/admin/users/${id}`, data),
  batchUsers: (ids: number[], data: { role?: string; status?: string }) =>
    api.post('/admin/users/batch', { ids, ...data }),
  getTenants: (params?: { page?: number; size?: number; status?: string; keyword?: string; ownerId?: number; startDate?: string; endDate?: string }) =>
    api.get(`/admin/tenants?${toQuery(params)}`),
  stopTenant: (id: string) => api.post(`/admin/tenants/${id}/stop`),
  restartTenant: (id: string) => api.post(`/admin/tenants/${id}/restart`),
  batchTenants: (ids: string[], action: 'stop' | 'restart') =>
    api.post('/admin/tenants/batch', { ids, action }),
  getPlugins: () => api.get('/admin/plugins'),
  updatePlugin: (id: string, data: Record<string, unknown>) =>
    api.patch(`/admin/plugins/${id}`, data),
  getSubscriptions: (params?: { page?: number; size?: number; status?: string; planType?: string; tenantId?: string; pluginId?: string; keyword?: string; startDate?: string; endDate?: string }) =>
    api.get(`/admin/subscriptions?${toQuery(params)}`),
  getPayments: (params?: { page?: number; size?: number; status?: string; provider?: string; tenantId?: string; pluginId?: string; userId?: number; keyword?: string; riskDecision?: PaymentRiskDecision; startDate?: string; endDate?: string }) =>
    api.get(`/admin/payments?${toQuery(params)}`),
  exportSubscriptionsCsv: (params?: { status?: string; planType?: string; tenantId?: string; pluginId?: string; keyword?: string; startDate?: string; endDate?: string }) =>
    api.get(`/admin/subscriptions/export.csv?${toQuery(params)}`, { responseType: 'blob' }),
  exportPaymentsCsv: (params?: { status?: string; provider?: string; tenantId?: string; pluginId?: string; userId?: number; keyword?: string; riskDecision?: PaymentRiskDecision; startDate?: string; endDate?: string }) =>
    api.get(`/admin/payments/export.csv?${toQuery(params)}`, { responseType: 'blob' }),
  exportAuditLogsCsv: (params?: { action?: string; userId?: number; startDate?: string; endDate?: string }) =>
    api.get(`/admin/audit-logs/export.csv?${toQuery(params)}`, { responseType: 'blob' }),
  getAuditLogs: (params?: { action?: string; userId?: number; startDate?: string; endDate?: string; page?: number; size?: number }) =>
    api.get<{ rows: AuditLog[]; total: number; page: number; size: number }>(
      `/admin/audit-logs?${toQuery(params)}`
    ),
  confirmPayment: (id: number) => api.post(`/admin/payments/${id}/confirm`),
  rejectPayment: (id: number) => api.post(`/admin/payments/${id}/reject`),
  refundPayment: (id: number) => api.post(`/admin/payments/${id}/refund`),
  batchPayments: (ids: number[], action: 'confirm' | 'reject') =>
    api.post('/admin/payments/batch', { ids, action }),
};

export default { auth, tenants, instances, plugins, subscriptions, pluginRuntime, admin };
