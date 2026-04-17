import { useQuery } from '@tanstack/react-query';
import { Users, Server, Activity, DollarSign, AlertTriangle, ShieldAlert, TrendingUp, Wallet } from 'lucide-react';
import api, { type AdminStats } from '../../lib/api';

export default function AdminDashboard() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.admin.getStats().then((r) => r.data),
  });

  const s: AdminStats = stats ?? {
    userCount: 0,
    tenantCount: 0,
    runningCount: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    pendingReviewCount: 0,
    riskRejectCount: 0,
    payConversion: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">平台概览</h1>
        <p className="text-gray-500 text-sm mt-1">查看平台整体运营数据</p>
      </div>

      {error && (
        <div className="card text-center text-red-600 py-8">
          <p>加载统计数据失败</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="注册用户"
            value={s.userCount}
            icon={<Users size={20} />}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            title="租户总数"
            value={s.tenantCount}
            icon={<Server size={20} />}
            color="bg-purple-50 text-purple-600"
          />
          <StatCard
            title="运行实例"
            value={s.runningCount}
            icon={<Activity size={20} />}
            color="bg-green-50 text-green-600"
          />
          <StatCard
            title="总收入"
            value={`¥${(s.totalRevenue / 100).toFixed(2)}`}
            icon={<DollarSign size={20} />}
            color="bg-amber-50 text-amber-600"
          />
          <StatCard
            title="今日收入"
            value={`¥${(s.todayRevenue / 100).toFixed(2)}`}
            icon={<Wallet size={20} />}
            color="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            title="待复核订单"
            value={s.pendingReviewCount}
            icon={<AlertTriangle size={20} />}
            color="bg-orange-50 text-orange-600"
          />
          <StatCard
            title="风控拒绝"
            value={s.riskRejectCount}
            icon={<ShieldAlert size={20} />}
            color="bg-rose-50 text-rose-600"
          />
          <StatCard
            title="支付转化率(30天)"
            value={`${(s.payConversion * 100).toFixed(2)}%`}
            icon={<TrendingUp size={20} />}
            color="bg-cyan-50 text-cyan-600"
          />
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className={`rounded-lg p-2 ${color}`}>{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
