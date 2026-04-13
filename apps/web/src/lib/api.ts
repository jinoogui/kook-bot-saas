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
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export interface User {
  id: string;
  email: string;
  username: string;
}

export interface Tenant {
  id: string;
  name: string;
  bot_token: string;
  verify_token?: string;
  encrypt_key?: string;
  status: 'running' | 'stopped' | 'error';
  port?: number;
  created_at: string;
  updated_at: string;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  price_monthly: number;
  config_schema?: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plugin_id: string;
  plugin_name: string;
  plan_type: string;
  status: string;
  enabled: boolean;
  config: Record<string, unknown>;
  expires_at: string;
  created_at: string;
}

export interface InstanceStatus {
  tenant_id: string;
  status: 'running' | 'stopped' | 'error';
  port: number | null;
  uptime: number | null;
  last_heartbeat: string | null;
  restart_count: number;
}

const auth = {
  register: (email: string, username: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/register', { email, username, password }),

  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }),

  getMe: () => api.get<{ user: User }>('/auth/me'),
};

const tenants = {
  list: () => api.get<{ tenants: Tenant[] }>('/tenants'),

  create: (data: { name: string; bot_token: string; verify_token?: string; encrypt_key?: string }) =>
    api.post<{ tenant: Tenant }>('/tenants', data),

  get: (id: string) => api.get<{ tenant: Tenant }>(`/tenants/${id}`),

  update: (id: string, data: Partial<Tenant>) =>
    api.put<{ tenant: Tenant }>(`/tenants/${id}`, data),

  delete: (id: string) => api.delete(`/tenants/${id}`),
};

const instances = {
  start: (id: string) => api.post<{ status: InstanceStatus }>(`/instances/${id}/start`),

  stop: (id: string) => api.post<{ status: InstanceStatus }>(`/instances/${id}/stop`),

  restart: (id: string) => api.post<{ status: InstanceStatus }>(`/instances/${id}/restart`),

  status: (id: string) => api.get<{ status: InstanceStatus }>(`/instances/${id}/status`),
};

const plugins = {
  list: () => api.get<{ plugins: Plugin[] }>('/plugins'),

  get: (id: string) => api.get<{ plugin: Plugin }>(`/plugins/${id}`),
};

const subscriptions = {
  list: (tenantId: string) =>
    api.get<{ subscriptions: Subscription[] }>(`/tenants/${tenantId}/subscriptions`),

  subscribe: (tenantId: string, pluginId: string, planType: string) =>
    api.post<{ subscription: Subscription }>(`/tenants/${tenantId}/subscriptions`, {
      plugin_id: pluginId,
      plan_type: planType,
    }),

  unsubscribe: (tenantId: string, pluginId: string) =>
    api.delete(`/tenants/${tenantId}/subscriptions/${pluginId}`),

  toggle: (tenantId: string, pluginId: string, enabled: boolean) =>
    api.patch<{ subscription: Subscription }>(
      `/tenants/${tenantId}/subscriptions/${pluginId}/toggle`,
      { enabled },
    ),

  updateConfig: (tenantId: string, pluginId: string, config: Record<string, unknown>) =>
    api.patch<{ subscription: Subscription }>(
      `/tenants/${tenantId}/subscriptions/${pluginId}/config`,
      { config },
    ),
};

export default { auth, tenants, instances, plugins, subscriptions };
