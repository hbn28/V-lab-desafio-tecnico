import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Categoria, Direcao, OrdenarPor, Prioridade, SolicitacoesConsulta, Status } from '../types';

const status = ['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA'] satisfies Status[];
const categorias = ['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO'] satisfies Categoria[];
const prioridades = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] satisfies Prioridade[];
const ordenacoes = ['prioridade', 'data', 'horario'] satisfies OrdenarPor[];
const chavesConsulta = ['q', 'status', 'status_grupo', 'categoria', 'prioridade', 'data_agendada', 'data_de', 'data_ate', 'resultado_contato', 'ordenar_por', 'direcao', 'page', 'per_page'];

function valor<T extends string>(params: URLSearchParams, chave: string, valores: readonly T[]): T | undefined {
  const item = params.get(chave);
  return item && valores.includes(item as T) ? item as T : undefined;
}

function inteiroPositivo(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const numero = Number(value);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : undefined;
}

export function parseSolicitacoesQuery(search: string | URLSearchParams): SolicitacoesConsulta {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const pages: Record<string, number> = {};
  params.forEach((value, key) => {
    const match = /^agenda_page_(\d{4}-\d{2}-\d{2})$/.exec(key);
    const page = inteiroPositivo(value);
    if (match && page) pages[match[1]] = page;
  });

  return {
    visao: valor(params, 'visao', ['fila', 'agenda', 'historico', 'faltas']),
    data: params.get('data') || undefined,
    inicio: params.get('inicio') || undefined,
    agendaPages: pages,
    q: params.get('q') || undefined,
    status: valor(params, 'status', status),
    status_grupo: valor(params, 'status_grupo', ['aberto', 'encerrado']),
    categoria: valor(params, 'categoria', categorias),
    prioridade: valor(params, 'prioridade', prioridades),
    data_agendada: params.get('data_agendada') || undefined,
    data_de: params.get('data_de') || undefined,
    data_ate: params.get('data_ate') || undefined,
    resultado_contato: valor(params, 'resultado_contato', ['SEM_RESPOSTA', 'RECADO', 'CONFIRMOU_RETORNO', 'NUMERO_INVALIDO']),
    ordenar_por: valor(params, 'ordenar_por', ordenacoes),
    direcao: valor(params, 'direcao', ['asc', 'desc'] satisfies Direcao[]),
    page: inteiroPositivo(params.get('page')),
    per_page: inteiroPositivo(params.get('per_page')),
  };
}

export function serializeSolicitacoesQuery(consulta: SolicitacoesConsulta): URLSearchParams {
  const params = new URLSearchParams();
  const valores: Record<string, string | number | undefined> = {
    visao: consulta.visao,
    data: consulta.data,
    inicio: consulta.inicio,
    q: consulta.q,
    status: consulta.status,
    status_grupo: consulta.status_grupo,
    categoria: consulta.categoria,
    prioridade: consulta.prioridade,
    data_agendada: consulta.data_agendada,
    data_de: consulta.data_de,
    data_ate: consulta.data_ate,
    resultado_contato: consulta.resultado_contato,
    ordenar_por: consulta.ordenar_por,
    direcao: consulta.direcao,
    page: consulta.page,
    per_page: consulta.per_page,
  };
  Object.entries(valores).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  Object.entries(consulta.agendaPages ?? {}).forEach(([data, page]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(data) && Number.isSafeInteger(page) && page > 1) {
      params.set(`agenda_page_${data}`, String(page));
    }
  });
  return params;
}

export function useSolicitacoesQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const consulta = useMemo(() => parseSolicitacoesQuery(searchParams), [searchParams]);

  const atualizar = useCallback((next: SolicitacoesConsulta) => {
    const preserved = new URLSearchParams(searchParams);
    chavesConsulta.forEach(key => preserved.delete(key));
    Array.from(preserved.keys()).filter(key => key.startsWith('agenda_page_')).forEach(key => preserved.delete(key));
    serializeSolicitacoesQuery(next).forEach((value, key) => preserved.set(key, value));
    setSearchParams(preserved);
  }, [searchParams, setSearchParams]);

  const aplicar = useCallback((patch: Partial<SolicitacoesConsulta>) => {
    atualizar({ ...consulta, ...patch, agendaPages: patch.agendaPages ?? {}, page: 1 });
  }, [atualizar, consulta]);

  const limpar = useCallback(() => {
    atualizar({
      visao: consulta.visao,
      data: consulta.data,
      inicio: consulta.inicio,
      agendaPages: {},
      status_grupo: consulta.status_grupo,
    });
  }, [atualizar, consulta]);

  const setPagina = useCallback((page: number) => atualizar({ ...consulta, page }), [atualizar, consulta]);

  return { consulta, aplicar, limpar, setPagina };
}
