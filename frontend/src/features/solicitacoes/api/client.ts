import type {
  CriarSolicitacaoPayload,
  FiltrosSolicitacoes,
  ListaSolicitacoes,
  Solicitacao,
  Status,
} from '../types';

export type ListarParams = FiltrosSolicitacoes;

const BASE_URL = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = Object.assign(new Error(body?.message ?? 'Erro desconhecido'), {
      status: response.status,
      errors: body?.errors ?? {},
    });
    throw error;
  }

  return body as T;
}

export const solicitacoesApi = {
  async listar(filtros: ListarParams = {}): Promise<{ data: Solicitacao[]; total: number; last_page: number }> {
    const params = new URLSearchParams();
    if (filtros.status)     params.set('status', filtros.status);
    if (filtros.categoria)  params.set('categoria', filtros.categoria);
    if (filtros.prioridade) params.set('prioridade', filtros.prioridade);
    if (filtros.page)       params.set('page', String(filtros.page));
    if (filtros.per_page)   params.set('per_page', String(filtros.per_page));
    const qs = params.toString() ? `?${params}` : '';
    const res = await request<ListaSolicitacoes>(`/api/v1/solicitacoes${qs}`);
    return { data: res.data, total: res.meta.total, last_page: res.meta.last_page };
  },

  async buscar(id: string): Promise<Solicitacao> {
    const res = await request<{ data: Solicitacao }>(`/api/v1/solicitacoes/${id}`);
    return res.data;
  },

  async criar(payload: CriarSolicitacaoPayload): Promise<Solicitacao> {
    const res = await request<{ data: Solicitacao }>('/api/v1/solicitacoes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async atualizarStatus(id: string, status: Status): Promise<Solicitacao> {
    const res = await request<{ data: Solicitacao }>(`/api/v1/solicitacoes/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return res.data;
  },
};
