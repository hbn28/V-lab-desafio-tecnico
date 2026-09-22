import { useState, useEffect, useCallback } from 'react';
import { usePolling } from '../../../hooks/usePolling';
import { solicitacoesApi, type ListarParams } from '../api/client';
import type { ResumoSolicitacoes, Solicitacao } from '../types';

const POLL_INTERVAL_MS = 30_000;

export function useSolicitacoes(params: ListarParams = {}) {
  const [data, setData] = useState<{ data: Solicitacao[]; total: number; last_page: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(params);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await solicitacoesApi.listar(params);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar solicitações');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

export function useSolicitacao(id: string) {
  const [data, setData] = useState<Solicitacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silencioso = false) => {
    // Recarga silenciosa mantém a tela montada (ex.: formulário de agendamento em edição).
    if (!silencioso) { setLoading(true); setError(null); }
    try {
      const result = await solicitacoesApi.buscar(id);
      setData(result);
      if (silencioso) setError(null);
    } catch (e: unknown) {
      if (!silencioso) setError(e instanceof Error ? e.message : 'Erro ao carregar solicitação');
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: () => load(), refresh: () => load(true) };
}

interface ResumoOptions {
  /** true pausa a revalidação silenciosa em segundo plano (ex.: drill-down aberto). */
  paused?: boolean;
}

export function useResumoSolicitacoes(filtros: Parameters<typeof solicitacoesApi.resumo>[0] = {}, options: ResumoOptions = {}) {
  const [data, setData] = useState<ResumoSolicitacoes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(filtros);
  const load = useCallback(async (silencioso = false) => {
    if (!silencioso) { setLoading(true); setError(null); }
    try {
      const result = await solicitacoesApi.resumo(filtros);
      setData(result);
      if (silencioso) setError(null);
    } catch (e: unknown) {
      // Uma revalidação silenciosa que falha não deve substituir o painel por
      // uma tela de erro — mantém os últimos dados bons na tela.
      if (!silencioso) setError(e instanceof Error ? e.message : 'Erro ao carregar o resumo do painel');
    } finally {
      if (!silencioso) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { load(); }, [load]);
  usePolling(() => load(true), { intervalMs: POLL_INTERVAL_MS, enabled: !options.paused });

  return { data, loading, error, reload: load };
}

export function useProximoAtendimento(options: ResumoOptions = {}) {
  const [data, setData] = useState<Solicitacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silencioso = false) => {
    if (!silencioso) { setLoading(true); setError(null); }
    try {
      // Mesma ordem operacional já usada pela listagem (ADR 001): aberta,
      // maior prioridade, mais antiga primeiro — aqui só pedimos a primeira.
      const result = await solicitacoesApi.listar({ status_grupo: 'aberto', per_page: 1 });
      setData(result.data[0] ?? null);
      if (silencioso) setError(null);
    } catch (e: unknown) {
      if (!silencioso) setError(e instanceof Error ? e.message : 'Erro ao carregar o próximo atendimento');
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  usePolling(() => load(true), { intervalMs: POLL_INTERVAL_MS, enabled: !options.paused });

  return { data, loading, error, reload: load };
}
