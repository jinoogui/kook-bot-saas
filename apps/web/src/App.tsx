import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BotSetupPage from './pages/BotSetupPage';
import PluginStorePage from './pages/PluginStorePage';
import PluginConfigPage from './pages/PluginConfigPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import MonitoringPage from './pages/MonitoringPage';

export default function App() {
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
      <Route path="/login" element={<LoginPage auth={auth} />} />
      <Route path="/register" element={<RegisterPage auth={auth} />} />
      <Route
        element={
          <ProtectedRoute isAuthenticated={auth.isAuthenticated}>
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
