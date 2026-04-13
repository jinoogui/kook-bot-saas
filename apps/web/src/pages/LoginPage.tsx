import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import type { User } from '../lib/api';

interface LoginPageProps {
  auth: {
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<User>;
  };
}

export default function LoginPage({ auth }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.login(email, password);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '\u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u90AE\u7BB1\u548C\u5BC6\u7801';
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
          <p className="text-gray-500 mt-2">\u767B\u5F55\u4F60\u7684\u8D26\u6237</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">\u5BC6\u7801</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="\u8F93\u5165\u5BC6\u7801"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <LogIn size={18} />
              {loading ? '\u767B\u5F55\u4E2D...' : '\u767B\u5F55'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            \u8FD8\u6CA1\u6709\u8D26\u6237\uFF1F{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              \u6CE8\u518C
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
