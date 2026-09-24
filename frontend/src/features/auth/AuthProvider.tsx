import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from './api/client';
import type { ApiError, Operator } from './types';
import { AuthContext } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authApi.me().then(account => {
      if (active) setUser(account);
    }).catch((caught: ApiError) => {
      if (active && caught.status !== 401) setError(caught.message);
    }).finally(() => {
      if (active) setLoading(false);
    });

    const expired = () => {
      setUser(null);
      setError('Sua sessão terminou. Entre novamente para continuar.');
    };
    window.addEventListener('auth:expired', expired);
    return () => {
      active = false;
      window.removeEventListener('auth:expired', expired);
    };
  }, []);

  const login = async (identifier: string, password: string) => {
    setError(null);
    try {
      const account = await authApi.login(identifier, password);
      setUser(account);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Não foi possível entrar.';
      setError(message);
      throw caught;
    }
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setError(null);
  };

  return <AuthContext.Provider value={{ user, loading, error, login, logout }}>{children}</AuthContext.Provider>;
}
