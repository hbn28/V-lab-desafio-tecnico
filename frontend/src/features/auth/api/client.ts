import type { ApiError, Operator } from '../types';

export function csrfHeader(): Record<string, string> {
  const cookie = document.cookie.split('; ').find(part => part.startsWith('XSRF-TOKEN='));
  return cookie ? { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...csrfHeader(), ...options.headers },
    });
  } catch {
    throw Object.assign(new Error('Não foi possível conectar ao servidor.'), { status: 0, errors: {} }) as ApiError;
  }

  const body = await response.json().catch(() => ({})) as { data?: T; message?: string; errors?: Record<string, string[]> };
  if (!response.ok) {
    throw Object.assign(new Error(body.message ?? 'Não foi possível concluir a operação.'), {
      status: response.status,
      errors: body.errors ?? {},
    }) as ApiError;
  }
  return body.data as T;
}

export const authApi = {
  async me(): Promise<Operator> {
    return request<Operator>('/api/v1/auth/me');
  },
  async login(identifier: string, password: string): Promise<Operator> {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    return request<Operator>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: identifier, password }),
    });
  },
  async logout(): Promise<void> {
    await request<null>('/api/v1/auth/logout', { method: 'POST' });
  },
};
