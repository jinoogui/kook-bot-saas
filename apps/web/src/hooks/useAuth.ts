import { useState, useEffect, useCallback } from 'react';
import api, { type User } from '../lib/api';

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      if (saved && saved !== 'undefined') return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user && !!localStorage.getItem('token');
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.auth
        .getMe()
        .then((res) => {
          const userData = res.data as any;
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    const payload = res.data as any;
    const userData: User = {
      id: String(payload.userId),
      email,
      username: payload.username,
      role: payload.role ?? 'user',
    };
    localStorage.setItem('token', payload.token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const res = await api.auth.register(email, username, password);
    const payload = res.data as any;
    const userData: User = {
      id: String(payload.userId),
      email,
      username: payload.username,
      role: payload.role ?? 'user',
    };
    localStorage.setItem('token', payload.token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  return { user, loading, isAuthenticated, isAdmin, login, register, logout };
}
