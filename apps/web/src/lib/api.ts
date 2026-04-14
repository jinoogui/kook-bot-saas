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
  status: 'running' | 'stopped' | 'error' | 'starting';
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
  isEnabled?: number;
  config: Record<string, unknown>;
  configJson?: string;
  expiresAt?: string;
  startedAt?: string;
  createdAt: string;
}

export interface InstanceStatus {
  tenantId: string;
  status: 'running' | 'stopped' | 'error';
  uptime: number | null;
  lastHeartbeat: string | null;
  restartCount: number;
}

export interface InstanceLog {
  id: number;
  tenantId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: string;
  createdAt: string;
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
    api.get<Subscription[]>(`/tenants/${tenantId}/subscriptions`),

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

const admin = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (page = 1, size = 20) => api.get(`/admin/users?page=${page}&size=${size}`),
  updateUser: (id: number, data: { role?: string; status?: string }) =>
    api.patch(`/admin/users/${id}`, data),
  getTenants: () => api.get('/admin/tenants'),
  stopTenant: (id: string) => api.post(`/admin/tenants/${id}/stop`),
  restartTenant: (id: string) => api.post(`/admin/tenants/${id}/restart`),
  getPlugins: () => api.get('/admin/plugins'),
  updatePlugin: (id: string, data: Record<string, unknown>) =>
    api.patch(`/admin/plugins/${id}`, data),
  getSubscriptions: () => api.get('/admin/subscriptions'),
  getPayments: () => api.get('/admin/payments'),
  getAuditLogs: (params?: { action?: string; userId?: number; startDate?: string; endDate?: string; page?: number; size?: number }) => {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.userId) query.set('userId', String(params.userId));
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.page) query.set('page', String(params.page));
    if (params?.size) query.set('size', String(params.size));
    return api.get<{ rows: AuditLog[]; total: number; page: number; size: number }>(
      `/admin/audit-logs?${query.toString()}`
    );
  },
  confirmPayment: (id: number) => api.post(`/admin/payments/${id}/confirm`),
  rejectPayment: (id: number) => api.post(`/admin/payments/${id}/reject`),
};

export default { auth, tenants, instances, plugins, subscriptions, admin };
