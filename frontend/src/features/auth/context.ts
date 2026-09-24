import { createContext, useContext } from 'react';
import type { CadastroPayload, Operator } from './types';

export interface AuthState {
  user: Operator | null;
  loading: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  cadastrar: (payload: CadastroPayload) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider não encontrado.');
  return context;
}

export function useOptionalAuth(): AuthState | null {
  return useContext(AuthContext);
}
