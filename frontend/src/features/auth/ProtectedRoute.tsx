import type { ReactNode } from 'react';
import { useAuth } from './context';
import { LoginPage } from './LoginPage';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="state-view state-view--page" role="status">Verificando acesso…</div>;
  if (!user) return <LoginPage />;
  return <>{children}</>;
}
