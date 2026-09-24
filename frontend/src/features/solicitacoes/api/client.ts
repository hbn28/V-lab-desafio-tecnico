import type {
  Agendamento,
  AgendamentoPayload,
  AtualizarSolicitacaoPayload,
  AtualizarStatusPayload,
  CriarSolicitacaoPayload,
  EntradaFilaItem,
  FiltrosFaltas,
  FiltrosFila,
  FiltrosSolicitacoes,
  ListaFaltas,
  ListaSolicitacoes,
  RegistrarContatoPayload,
  ResumoSolicitacoes,
  Solicitacao,
  TentativaContato,
} from '../types';

export type ListarParams = FiltrosSolicitacoes;

const BASE_URL = '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
    });
  } catch {
    throw Object.assign(new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'), {
      status: 0,
      errors: {} as Record<string, string[]>,
    });
  }

  const rawText = await response.text().catch(() => '');
  let body: unknown = {};
  let parseFailed = false;

  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      parseFailed = true;
    }
  }

  if (!response.ok) {
    const parsedBody = (typeof body === 'object' && body !== null ? body : {}) as {
      message?: string;
      errors?: Record<string, string[]>;
    };
    const error = Object.assign(
      new Error(parsedBody.message ?? 'Ocorreu um erro inesperado. Tente novamente.'),
      {
        status: response.status,
        errors: (parsedBody.errors ?? {}) as Record<string, string[]>,
      }
    );
    throw error;
  }

  if (parseFailed || typeof body !== 'object' || body === null) {
    throw Object.assign(
      new Error('O servidor retornou uma resposta inesperada. Tente novamente em instantes.'),
      { status: response.status, errors: {} as Record<string, string[]> }
    );
  }

  return body as T;
}

export const solicitacoesApi = {
  async listar(filtros: ListarParams = {}): Promise<{ data: Solicitacao[]; total: number; last_page: number }> {
    const params = new URLSearchParams();
    if (filtros.status)     params.set('status', filtros.status);
    if (filtros.status_grupo) params.set('status_grupo', filtros.status_grupo);
    if (filtros.categoria)  params.set('categoria', filtros.categoria);
    if (filtros.prioridade) params.set('prioridade', filtros.prioridade);
    if (filtros.data_agendada) params.set('data_agendada', filtros.data_agendada);
    if (filtros.page)       params.set('page', String(filtros.page));
    if (filtros.per_page)   params.set('per_page', String(filtros.per_page));
    const qs = params.toString() ? `?${params}` : '';
    const res = await request<ListaSolicitacoes>(`/api/v1/solicitacoes${qs}`);
    if (!res?.data || !res?.meta) {
      throw new Error('O servidor retornou uma resposta inesperada ao listar as solicitações.');
    }
    return { data: res.data, total: res.meta.total, last_page: res.meta.last_page };
  },

  async resumo(filtros: Pick<FiltrosSolicitacoes, 'categoria' | 'prioridade'> = {}): Promise<ResumoSolicitacoes> {
    const params = new URLSearchParams();
    if (filtros.categoria)  params.set('categoria', filtros.categoria);
    if (filtros.prioridade) params.set('prioridade', filtros.prioridade);
    const qs = params.toString() ? `?${params}` : '';
    const res = await request<{ data: ResumoSolicitacoes }>(`/api/v1/solicitacoes/resumo${qs}`);
    if (!res?.data) {
      throw new Error('O servidor retornou uma resposta inesperada ao buscar o resumo.');
    }
    return res.data;
  },

  async buscar(id: string): Promise<Solicitacao> {
    const res = await request<{ data: Solicitacao }>(`/api/v1/solicitacoes/${id}`);
    if (!res?.data) {
      throw new Error('O servidor retornou uma resposta inesperada ao buscar a solicitação.');
    }
    return res.data;
  },

  async criar(payload: CriarSolicitacaoPayload): Promise<Solicitacao> {
    const res = await request<{ data: Solicitacao }>('/api/v1/solicitacoes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res?.data) {
      throw new Error('Não foi possível confirmar a criação da solicitação. Tente novamente.');
    }
    return res.data;
  },

  async atualizarStatus(id: string, payload: AtualizarStatusPayload): Promise<Solicitacao> {
    const res = await request<{ data: Solicitacao }>(`/api/v1/solicitacoes/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!res?.data) {
      throw new Error('Não foi possível confirmar a atualização do status. Tente novamente.');
    }
    return res.data;
  },

  async reagendar(id: string, payload: AgendamentoPayload): Promise<Solicitacao> {
    const res = await request<{ data: Solicitacao }>(`/api/v1/solicitacoes/${id}/agendamento`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!res?.data) {
      throw new Error('Não foi possível confirmar o reagendamento. Tente novamente.');
    }
    return res.data;
  },

  async atualizar(id: string, payload: AtualizarSolicitacaoPayload): Promise<Solicitacao> {
    const res = await request<{ data: Solicitacao }>(`/api/v1/solicitacoes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res?.data) {
      throw new Error('Não foi possível confirmar a edição da solicitação. Tente novamente.');
    }
    return res.data;
  },

  async apagar(id: string): Promise<void> {
    await request<unknown>(`/api/v1/solicitacoes/${id}`, {
      method: 'DELETE',
    });
  },

  async listarFila(filtros: FiltrosFila = {}): Promise<{ data: EntradaFilaItem[]; total: number; last_page: number }> {
    const params = new URLSearchParams();
    if (filtros.page)     params.set('page', String(filtros.page));
    if (filtros.per_page) params.set('per_page', String(filtros.per_page));
    const qs = params.toString() ? `?${params}` : '';
    const res = await request<{ data: EntradaFilaItem[]; meta: ListaSolicitacoes['meta'] }>(`/api/v1/fila${qs}`);
    if (!res?.data || !res?.meta) {
      throw new Error('O servidor retornou uma resposta inesperada ao listar a fila.');
    }
    return { data: res.data, total: res.meta.total, last_page: res.meta.last_page };
  },

  async listarFaltas(filtros: FiltrosFaltas = {}): Promise<ListaFaltas> {
    const params = new URLSearchParams();
    if (filtros.page)     params.set('page', String(filtros.page));
    if (filtros.per_page) params.set('per_page', String(filtros.per_page));
    const qs = params.toString() ? `?${params}` : '';
    const res = await request<ListaFaltas>(`/api/v1/faltas${qs}`);
    if (!res?.data || !res?.meta) {
      throw new Error('O servidor retornou uma resposta inesperada ao listar as faltas.');
    }
    return res;
  },

  async registrarFalta(agendamentoId: number): Promise<Agendamento> {
    const res = await request<{ data: Agendamento }>(`/api/v1/agendamentos/${agendamentoId}/falta`, {
      method: 'POST',
    });
    if (!res?.data) {
      throw new Error('Não foi possível registrar a falta. Tente novamente.');
    }
    return res.data;
  },

  async registrarContato(agendamentoId: number, payload: RegistrarContatoPayload): Promise<TentativaContato> {
    const res = await request<{ data: TentativaContato }>(`/api/v1/agendamentos/${agendamentoId}/tentativas-contato`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res?.data) {
      throw new Error('Não foi possível registrar a tentativa de contato. Tente novamente.');
    }
    return res.data;
  },

  async reagendarAposFalta(agendamentoId: number, payload: AgendamentoPayload): Promise<Agendamento> {
    const res = await request<{ data: Agendamento }>(`/api/v1/agendamentos/${agendamentoId}/reagendar-apos-falta`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res?.data) {
      throw new Error('Não foi possível reagendar após a falta. Tente novamente.');
    }
    return res.data;
  },
};
