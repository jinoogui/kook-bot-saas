import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BotSetupPage from './pages/BotSetupPage';
import PluginStorePage from './pages/PluginStorePage';
import PluginConfigPage from './pages/PluginConfigPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import MonitoringPage from './pages/MonitoringPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminTenantsPage from './pages/admin/AdminTenantsPage';
import AdminPluginsPage from './pages/admin/AdminPluginsPage';
import AdminSubscriptionsPage from './pages/admin/AdminSubscriptionsPage';
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage';

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

function AppRoutes() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <AdminRoute>
            <AdminLayout user={auth.user} onLogout={auth.logout} />
          </AdminRoute>
        }
      >
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/tenants" element={<AdminTenantsPage />} />
        <Route path="/admin/plugins" element={<AdminPluginsPage />} />
        <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />
        <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <Layout user={auth.user} onLogout={auth.logout} />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/bot-setup" element={<BotSetupPage />} />
        <Route path="/plugins" element={<PluginStorePage />} />
        <Route path="/plugins/:id/config" element={<PluginConfigPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/monitoring" element={<MonitoringPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
