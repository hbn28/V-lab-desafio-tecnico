import { useState, useEffect, useCallback } from 'react';
import { solicitacoesApi, type ListarParams } from '../api/client';
import type { ResumoSolicitacoes, Solicitacao } from '../types';

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await solicitacoesApi.buscar(id);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar solicitação');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

export function useResumoSolicitacoes(filtros: Parameters<typeof solicitacoesApi.resumo>[0] = {}) {
  const [data, setData] = useState<ResumoSolicitacoes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(filtros);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await solicitacoesApi.resumo(filtros);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar o resumo do painel');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}
