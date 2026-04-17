import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Activity,
  Clock,
  Wifi,
  RefreshCw,
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
} from 'lucide-react';
import api, { type InstanceLog, type InstanceDiagnosis } from '../lib/api';

export default function MonitoringPage() {
  const location = useLocation();
  const initialTenant = (location.state as { tenantId?: string })?.tenantId || '';
  const [selectedTenant, setSelectedTenant] = useState(initialTenant);
  const [logLevel, setLogLevel] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [diagnosis, setDiagnosis] = useState<InstanceDiagnosis | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.tenants.list().then((r) => r.data),
  });

  // Auto-select when user has only one bot
  useEffect(() => {
    if (!selectedTenant && tenants?.length === 1) {
      setSelectedTenant(tenants[0].id);
    }
  }, [tenants, selectedTenant]);

  const {
    data: status,
    isLoading,
    error: statusError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['instance-status', selectedTenant],
    queryFn: () => api.instances.status(selectedTenant).then((r) => r.data),
    enabled: !!selectedTenant,
    refetchInterval: 10000,
  });

  const {
    data: logsData,
    isLoading: logsLoading,
  } = useQuery({
    queryKey: ['instance-logs', selectedTenant, logLevel, logSearch],
    queryFn: () =>
      api.instances.logs(selectedTenant, {
        level: logLevel !== 'all' ? logLevel : undefined,
        search: logSearch || undefined,
        page: 1,
        size: 100,
      }).then((r) => r.data),
    enabled: !!selectedTenant,
    refetchInterval: status?.status === 'running' ? 5000 : false,
  });

  const diagnoseMutation = useMutation({
    mutationFn: () => api.instances.diagnose(selectedTenant).then((r) => r.data),
    onSuccess: (data) => setDiagnosis(data),
  });

  const logs: InstanceLog[] = (logsData as any)?.rows ?? [];

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length]);

  useEffect(() => {
    setDiagnosis(null);
  }, [selectedTenant]);

  const formatUptime = (seconds: number | null) => {
    if (seconds == null) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}小时 ${m}分 ${s}秒`;
    if (m > 0) return `${m}分 ${s}秒`;
    return `${s}秒`;
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return '--';
    return new Date(ts).toLocaleString('zh-CN');
  };

  const statusIcon = (s?: string) => {
    switch (s) {
      case 'running':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'starting':
      case 'stopping':
        return <RefreshCw className="text-blue-500 animate-spin" size={20} />;
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
        return '运行中';
      case 'starting':
        return '启动中';
      case 'stopping':
        return '停止中';
      case 'stopped':
        return '已停止';
      case 'error':
        return '错误';
      default:
        return '未知';
    }
  };

  const logLevelColor = (level: string) => {
    switch (level) {
      case 'info':
        return 'text-green-400';
      case 'warn':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">实例监控</h2>
          <p className="text-gray-500 text-sm mt-1">查看 Bot 实例的运行状态</p>
        </div>
        {selectedTenant && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => diagnoseMutation.mutate()}
              disabled={diagnoseMutation.isPending}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              {diagnoseMutation.isPending ? '诊断中...' : '一键诊断'}
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              刷新
            </button>
          </div>
        )}
      </div>

      {/* Tenant selector */}
      <div className="card max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-1">选择 Bot</label>
        <select
          className="input-field"
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
        >
          <option value="">请选择一个 Bot</option>
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

      {selectedTenant && statusError && (
        <div className="card text-center text-red-600 py-8">
          <p>加载实例状态失败</p>
        </div>
      )}

      {selectedTenant && status && (
        <>
          {/* Stats grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={statusIcon(status.status)}
              label="运行状态"
              value={statusLabel(status.status)}
            />
            <StatCard
              icon={<Clock className="text-purple-500" size={20} />}
              label="运行时间"
              value={formatUptime(status.uptime)}
            />
            <StatCard
              icon={<Wifi className="text-green-500" size={20} />}
              label="最后心跳"
              value={formatTime(status.lastHeartbeat)}
            />
            <StatCard
              icon={<Activity className="text-amber-500" size={20} />}
              label="重启次数"
              value={String(status.restartCount)}
            />
          </div>

          {diagnosis && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-3">诊断结果</h3>
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div>
                  <span className="text-gray-500">实例进程：</span>
                  <span className={diagnosis.checks.processTracked ? 'text-green-600' : 'text-red-600'}>
                    {diagnosis.checks.processTracked ? '已跟踪' : '未跟踪'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">插件表：</span>
                  <span className={diagnosis.checks.tenantTablesOk ? 'text-green-600' : 'text-red-600'}>
                    {diagnosis.checks.tenantTablesOk ? '完整' : '缺失'}
                  </span>
                </div>
              </div>
              {diagnosis.missingTables.length > 0 && (
                <p className="mt-2 text-xs text-red-600">缺失表: {diagnosis.missingTables.join(', ')}</p>
              )}
              {diagnosis.recentErrors.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">最近错误</p>
                  <div className="space-y-1">
                    {diagnosis.recentErrors.map((e) => (
                      <p key={e.id} className="text-xs text-red-600 break-all">{e.message}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Log viewer */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">运行日志</h3>
              <div className="flex items-center gap-3">
                <select
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value)}
                >
                  <option value="all">全部级别</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索日志..."
                    className="text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 w-48"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                  />
                </div>
                {status.status === 'running' && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    自动刷新
                  </span>
                )}
              </div>
            </div>
            <div className="bg-gray-900 text-gray-300 rounded-lg p-4 font-mono text-xs h-80 overflow-auto">
              {logsLoading ? (
                <p className="text-gray-500">加载日志中...</p>
              ) : logs.length === 0 ? (
                <p className="text-gray-500"># 暂无日志记录</p>
              ) : (
                [...logs].reverse().map((log) => (
                  <div key={log.id} className="py-0.5 flex gap-2">
                    <span className="text-gray-600 flex-shrink-0">
                      {log.createdAt ? new Date(log.createdAt).toLocaleTimeString('zh-CN') : '--'}
                    </span>
                    <span className={`flex-shrink-0 uppercase font-bold w-12 ${logLevelColor(log.level)}`}>
                      [{log.level}]
                    </span>
                    <span className="break-all">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
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
