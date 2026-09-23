import { csrfHeader } from '../../auth/api/client';
import type { ListaNotificacoes, Notificacao } from '../types';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...csrfHeader(), ...options.headers },
  });
  const body = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) {
    if (response.status === 401 || response.status === 419) window.dispatchEvent(new Event('auth:expired'));
    throw new Error(body.message ?? 'Não foi possível carregar as notificações.');
  }
  return body;
}

export const notificacoesApi = {
  listar: (page = 1) => request<ListaNotificacoes>(`/api/v1/notificacoes?page=${page}`),
  marcarLida: async (id: number) => (await request<{ data: Notificacao }>(`/api/v1/notificacoes/${id}/lida`, { method: 'PATCH' })).data,
};
