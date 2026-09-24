import { useEffect, useMemo, useState } from 'react';
import { solicitacoesApi } from '../api/client';
import type { FiltrosSolicitacoes, SolicitacaoListItem } from '../types';

export interface AgendaDiaEstado {
  data: SolicitacaoListItem[];
  total: number;
  last_page: number;
  loading: boolean;
  error: string | null;
}

export function deslocarDataIso(data: string, dias: number): string {
  const dataSegura = new Date(`${data}T12:00:00Z`);
  dataSegura.setUTCDate(dataSegura.getUTCDate() + dias);
  return dataSegura.toISOString().slice(0, 10);
}

export function datasDaSemana(inicio: string): string[] {
  return Array.from({ length: 7 }, (_, indice) => deslocarDataIso(inicio, indice));
}

interface UseAgendaSemanalOptions {
  inicio: string;
  filtros: Omit<FiltrosSolicitacoes, 'data_agendada' | 'page'>;
  paginas: Record<string, number>;
  enabled?: boolean;
}

export function useAgendaSemanal({ inicio, filtros, paginas, enabled = true }: UseAgendaSemanalOptions) {
  const datas = useMemo(() => datasDaSemana(inicio), [inicio]);
  const filtrosKey = JSON.stringify({ datas, filtros, paginas, enabled });
  const [grupos, setGrupos] = useState<Record<string, AgendaDiaEstado>>({});
  const [versaoReload, setVersaoReload] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelado = false;
    setGrupos(Object.fromEntries(datas.map(data => [data, {
      data: [], total: 0, last_page: 1, loading: true, error: null,
    }])));

    datas.forEach(async data => {
      try {
        const resultado = await solicitacoesApi.listar({
          ...filtros,
          status: 'AGENDADA',
          data_agendada: data,
          page: paginas[data] ?? 1,
          per_page: filtros.per_page ?? 10,
        });
        if (!cancelado) setGrupos(current => ({ ...current, [data]: { ...resultado, loading: false, error: null } }));
      } catch (erro: unknown) {
        if (!cancelado) setGrupos(current => ({ ...current, [data]: {
          data: [], total: 0, last_page: 1, loading: false,
          error: erro instanceof Error ? erro.message : 'Não foi possível carregar este dia.',
        } }));
      }
    });

    return () => { cancelado = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosKey, versaoReload]);

  return {
    datas,
    grupos,
    carregando: enabled && datas.some(data => grupos[data]?.loading ?? true),
    reload: () => setVersaoReload(versao => versao + 1),
  };
}
