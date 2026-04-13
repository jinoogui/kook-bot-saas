import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Clock,
  Wifi,
  RefreshCw,
  Server,
  Hash,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import api from '../lib/api';

export default function MonitoringPage() {
  const location = useLocation();
  const initialTenant = (location.state as { tenantId?: string })?.tenantId || '';
  const [selectedTenant, setSelectedTenant] = useState(initialTenant);

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.tenants.list().then((r) => r.data.tenants),
  });

  const {
    data: status,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['instance-status', selectedTenant],
    queryFn: () => api.instances.status(selectedTenant).then((r) => r.data.status),
    enabled: !!selectedTenant,
    refetchInterval: 10000,
  });

  const formatUptime = (seconds: number | null) => {
    if (seconds == null) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}\u5C0F\u65F6 ${m}\u5206 ${s}\u79D2`;
    if (m > 0) return `${m}\u5206 ${s}\u79D2`;
    return `${s}\u79D2`;
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return '--';
    return new Date(ts).toLocaleString('zh-CN');
  };

  const statusIcon = (s?: string) => {
    switch (s) {
      case 'running':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'stopped':
        return <XCircle className="text-gray-400" size={20} />;
      case 'error':
        return <AlertTriangle className="text-red-500" size={20} />;
      default:
        return <Server className="text-gray-300" size={20} />;
    }
  };

  const statusLabel = (s?: string) => {
    switch (s) {
      case 'running':
        return '\u8FD0\u884C\u4E2D';
      case 'stopped':
        return '\u5DF2\u505C\u6B62';
      case 'error':
        return '\u9519\u8BEF';
      default:
        return '\u672A\u77E5';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">\u5B9E\u4F8B\u76D1\u63A7</h2>
          <p className="text-gray-500 text-sm mt-1">\u67E5\u770B Bot \u5B9E\u4F8B\u7684\u8FD0\u884C\u72B6\u6001</p>
        </div>
        {selectedTenant && (
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            \u5237\u65B0
          </button>
        )}
      </div>

      {/* Tenant selector */}
      <div className="card max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-1">\u9009\u62E9 Bot</label>
        <select
          className="input-field"
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
        >
          <option value="">\u8BF7\u9009\u62E9\u4E00\u4E2A Bot</option>
          {tenants?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {selectedTenant && isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-primary-600" size={24} />
        </div>
      )}

      {selectedTenant && status && (
        <>
          {/* Stats grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={statusIcon(status.status)}
              label="\u8FD0\u884C\u72B6\u6001"
              value={statusLabel(status.status)}
            />
            <StatCard
              icon={<Hash className="text-blue-500" size={20} />}
              label="\u7AEF\u53E3"
              value={status.port != null ? String(status.port) : '--'}
            />
            <StatCard
              icon={<Clock className="text-purple-500" size={20} />}
              label="\u8FD0\u884C\u65F6\u95F4"
              value={formatUptime(status.uptime)}
            />
            <StatCard
              icon={<Wifi className="text-green-500" size={20} />}
              label="\u6700\u540E\u5FC3\u8DF3"
              value={formatTime(status.last_heartbeat)}
            />
            <StatCard
              icon={<Activity className="text-amber-500" size={20} />}
              label="\u91CD\u542F\u6B21\u6570"
              value={String(status.restart_count)}
            />
          </div>

          {/* Log viewer placeholder */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">\u8FD0\u884C\u65E5\u5FD7</h3>
            <div className="bg-gray-900 text-gray-300 rounded-lg p-4 font-mono text-sm h-64 overflow-auto">
              <p className="text-gray-500"># \u65E5\u5FD7\u8F93\u51FA\u5C06\u5728\u6B64\u5904\u663E\u793A...</p>
              <p className="text-gray-500"># \u6B64\u529F\u80FD\u5373\u5C06\u4E0A\u7EBF</p>
              <p className="text-gray-600 mt-2">
                [{new Date().toISOString()}] Bot instance monitoring initialized
              </p>
              {status.status === 'running' && (
                <>
                  <p className="text-green-400">
                    [{new Date().toISOString()}] Status: running on port {status.port}
                  </p>
                  <p className="text-gray-400">
                    [{new Date().toISOString()}] Heartbeat OK
                  </p>
                </>
              )}
              {status.status === 'stopped' && (
                <p className="text-yellow-400">
                  [{new Date().toISOString()}] Instance is stopped
                </p>
              )}
              {status.status === 'error' && (
                <p className="text-red-400">
                  [{new Date().toISOString()}] Error detected in instance
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
