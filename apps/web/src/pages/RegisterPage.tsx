import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import type { User } from '../lib/api';

interface RegisterPageProps {
  auth: {
    isAuthenticated: boolean;
    register: (email: string, username: string, password: string) => Promise<User>;
  };
}

export default function RegisterPage({ auth }: RegisterPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('\u4E24\u6B21\u8F93\u5165\u7684\u5BC6\u7801\u4E0D\u4E00\u81F4');
      return;
    }

    if (password.length < 6) {
      setError('\u5BC6\u7801\u81F3\u5C11\u9700\u89816\u4E2A\u5B57\u7B26');
      return;
    }

    setLoading(true);
    try {
      await auth.register(email, username, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '\u6CE8\u518C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Kook Bot SaaS</h1>
          <p className="text-gray-500 mt-2">\u521B\u5EFA\u65B0\u8D26\u6237</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">\u90AE\u7BB1</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">\u7528\u6237\u540D</label>
              <input
                type="text"
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="\u8F93\u5165\u7528\u6237\u540D"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">\u5BC6\u7801</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="\u81F3\u5C116\u4E2A\u5B57\u7B26"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">\u786E\u8BA4\u5BC6\u7801</label>
              <input
                type="password"
                className="input-field"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="\u518D\u6B21\u8F93\u5165\u5BC6\u7801"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              {loading ? '\u6CE8\u518C\u4E2D...' : '\u6CE8\u518C'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            \u5DF2\u6709\u8D26\u6237\uFF1F{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              \u767B\u5F55
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
