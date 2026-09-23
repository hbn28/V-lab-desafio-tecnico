import { useState, useEffect, useCallback, useRef } from 'react';
import { usePolling } from '../../../hooks/usePolling';
import { solicitacoesApi, type ListarParams } from '../api/client';
import type { FaltaListItem, FiltrosFaltas, ResumoSolicitacoes, Solicitacao } from '../types';

const POLL_INTERVAL_MS = 30_000;

export function useSolicitacoes(params: ListarParams = {}, enabled = true) {
  const [data, setData] = useState<{ data: Solicitacao[]; total: number; last_page: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const key = JSON.stringify(params);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const result = await solicitacoesApi.listar(params);
      if (version !== requestVersion.current) return;
      setData(result);
    } catch (e: unknown) {
      if (version !== requestVersion.current) return;
      setError(e instanceof Error ? e.message : 'Erro ao carregar solicitações');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (enabled) void load();
    return () => { requestVersion.current += 1; };
  }, [enabled, load]);

  return { data, loading, error, reload: load };
}

export function useSolicitacao(id: string) {
  const [data, setData] = useState<Solicitacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const load = useCallback(async (silencioso = false) => {
    const version = ++requestVersion.current;
    // Recarga silenciosa mantém a tela montada (ex.: formulário de agendamento em edição).
    if (!silencioso) { setLoading(true); setError(null); }
    try {
      const result = await solicitacoesApi.buscar(id);
      if (version !== requestVersion.current) return;
      setData(result);
      if (silencioso) setError(null);
      return true;
    } catch (e: unknown) {
      if (version !== requestVersion.current) return;
      if (silencioso) return false;
      if (!silencioso) setError(e instanceof Error ? e.message : 'Erro ao carregar solicitação');
    } finally {
      if (!silencioso && version === requestVersion.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setData(null);
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]);

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

export function useProximaSolicitacao(options: ResumoOptions = {}) {
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
      if (!silencioso) setError(e instanceof Error ? e.message : 'Erro ao carregar a próxima solicitação');
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  usePolling(() => load(true), { intervalMs: POLL_INTERVAL_MS, enabled: !options.paused });

  return { data, loading, error, reload: load };
}

interface FaltasOptions {
  /** false pula a busca por completo — usado quando a aba Faltas não está visível. */
  enabled?: boolean;
  filtros?: FiltrosFaltas;
}

export function useFaltas(options: FaltasOptions = {}) {
  const enabled = options.enabled ?? true;
  const filtros = options.filtros ?? {};
  const key = JSON.stringify(filtros);
  const [data, setData] = useState<{ data: FaltaListItem[]; total: number; last_page: number; current_page: number } | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const result = await solicitacoesApi.listarFaltas(filtros);
      if (version !== requestVersion.current) return;
      setData({ data: result.data, total: result.meta.total, last_page: result.meta.last_page, current_page: result.meta.current_page });
    } catch (e: unknown) {
      if (version !== requestVersion.current) return;
      setError(e instanceof Error ? e.message : 'Erro ao carregar as faltas');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  useEffect(() => {
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  return { data, loading, error, reload: load };
}
