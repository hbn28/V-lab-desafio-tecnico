import { useState } from 'react';
import { useFaltas } from '../hooks/useSolicitacoes';
import { solicitacoesApi } from '../api/client';
import { FaltaCard } from './FaltaCard';
import { ContatoFaltaDialog } from './ContatoFaltaDialog';
import { DialogOverlay } from './DialogOverlay';
import { AgendamentoForm } from './AgendamentoForm';
import { SolicitacoesToolbar } from './SolicitacoesToolbar';
import type { AgendamentoPayload, FaltaListItem, ResultadoContato, SolicitacoesConsulta } from '../types';

interface FaltasViewProps {
  consulta: SolicitacoesConsulta;
  page: number;
  onPageChange: (page: number) => void;
  onApply: (patch: Partial<SolicitacoesConsulta>) => void;
  onClear: () => void;
  onChangeView: (view: 'fila' | 'agenda' | 'historico' | 'faltas') => void;
}

function errosDeValidacao(caught: unknown): Record<string, string[]> {
  return caught instanceof Error && 'errors' in caught
    ? ((caught as Error & { errors?: Record<string, string[]> }).errors ?? {})
    : {};
}

export function FaltasView({ consulta, page, onPageChange, onApply, onClear, onChangeView }: FaltasViewProps) {
  const filtros = {
    q: consulta.q,
    prioridade: consulta.prioridade,
    data_de: consulta.data_de,
    data_ate: consulta.data_ate,
    resultado_contato: consulta.resultado_contato,
    ordenar_por: consulta.ordenar_por,
    direcao: consulta.direcao,
    page,
    per_page: 10,
  };
  const { data: faltas, loading, error, reload } = useFaltas({ filtros });
  const [faltaContato, setFaltaContato] = useState<FaltaListItem | null>(null);
  const [enviandoContato, setEnviandoContato] = useState(false);
  const [erroContato, setErroContato] = useState<string | null>(null);
  const [faltaReagendando, setFaltaReagendando] = useState<FaltaListItem | null>(null);
  const [salvandoReagendamento, setSalvandoReagendamento] = useState(false);
  const [errosReagendamento, setErrosReagendamento] = useState<Record<string, string[]>>({});
  const [erroReagendamento, setErroReagendamento] = useState<string | null>(null);

  const abrirContato = (falta: FaltaListItem) => { setErroContato(null); setFaltaContato(falta); };
  const fecharContato = () => setFaltaContato(null);
  const salvarContato = async (resultado: ResultadoContato) => {
    if (!faltaContato) return;
    setEnviandoContato(true);
    setErroContato(null);
    try {
      await solicitacoesApi.registrarContato(faltaContato.id, { resultado });
      setFaltaContato(null);
      await reload();
    } catch (caught: unknown) {
      setErroContato(caught instanceof Error ? caught.message : 'Erro ao registrar contato');
    } finally {
      setEnviandoContato(false);
    }
  };

  const abrirReagendamento = (falta: FaltaListItem) => { setErroReagendamento(null); setErrosReagendamento({}); setFaltaReagendando(falta); };
  const fecharReagendamento = () => { setErroReagendamento(null); setFaltaReagendando(null); };
  const salvarReagendamento = async (payload: AgendamentoPayload) => {
    if (!faltaReagendando) return;
    setSalvandoReagendamento(true);
    setErroReagendamento(null);
    setErrosReagendamento({});
    try {
      await solicitacoesApi.reagendarAposFalta(faltaReagendando.id, payload);
      setFaltaReagendando(null);
      await reload();
    } catch (caught: unknown) {
      const erros = errosDeValidacao(caught);
      if (Object.keys(erros).length > 0) {
        setErrosReagendamento(erros);
      } else {
        setErroReagendamento(caught instanceof Error ? caught.message : 'Não foi possível reagendar após a falta. Tente novamente.');
        if (caught instanceof Error && 'status' in caught && (caught as Error & { status?: number }).status === 409) await reload();
      }
    } finally {
      setSalvandoReagendamento(false);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div><p className="eyebrow">Ausências</p><h1>Faltas</h1></div>
      </header>
      <div className="view-switcher" aria-label="Visão da fila">
        <div className="view-switcher__group" role="group" aria-label="Escopo da listagem">
          <button type="button" className="button button--outline" onClick={() => onChangeView('fila')}>Fila</button>
          <button type="button" className="button button--outline" onClick={() => onChangeView('agenda')}>Solicitações agendadas</button>
          <button type="button" className="button button--outline" onClick={() => onChangeView('historico')}>Histórico</button>
          <button type="button" className="button button--outline is-active" aria-pressed="true" onClick={() => onChangeView('faltas')}>Faltas</button>
        </div>
      </div>
      <SolicitacoesToolbar
        consulta={consulta}
        opcoesOrdenacao={['prioridade', ...(consulta.data ? [] : ['data' as const]), 'horario']}
        ordenacaoPadrao="prioridade"
        total={faltas?.total ?? 0}
        mostrarPrioridade
        mostrarPeriodo={!consulta.data}
        mostrarResultadoContato
        onApply={onApply}
        onClear={onClear}
      />
      {loading && <div className="state-view" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /><strong>Carregando faltas</strong></div>}
      {error && <div className="alert alert--error" role="alert"><div><strong>Não foi possível carregar as faltas</strong><p>{error}</p></div><button onClick={reload} className="button button--outline" type="button">Tentar novamente</button></div>}
      {!loading && !error && (faltas?.data.length ?? 0) === 0 && <div className="state-view"><span className="state-view__icon" aria-hidden="true">○</span><strong>Nenhuma falta pendente</strong></div>}
      {!loading && !error && faltas && faltas.data.length > 0 && <>
        <div className="faltas-list">{faltas.data.map(falta => <FaltaCard key={falta.id} falta={falta} onRegistrarContato={abrirContato} onReagendar={abrirReagendamento} />)}</div>
        <nav className="pagination" aria-label="Paginação das faltas">
          <p>Página <strong>{faltas.current_page}</strong> de <strong>{faltas.last_page}</strong></p>
          <div className="pagination__actions">
            <button className="button button--outline" disabled={faltas.current_page === 1} onClick={() => onPageChange(faltas.current_page - 1)} type="button">Anterior</button>
            <button className="button button--outline" disabled={faltas.current_page === faltas.last_page} onClick={() => onPageChange(faltas.current_page + 1)} type="button">Próxima</button>
          </div>
        </nav>
      </>}
      {faltaContato && <ContatoFaltaDialog submitting={enviandoContato} error={erroContato} onSalvar={salvarContato} onCancelar={fecharContato} />}
      {faltaReagendando && <DialogOverlay labelledBy="reagendar-falta-heading" onClose={fecharReagendamento}>
        <h2 id="reagendar-falta-heading">Reagendar após falta</h2>
        {erroReagendamento && <div className="alert alert--error" role="alert">{erroReagendamento}</div>}
        <AgendamentoForm submitting={salvandoReagendamento} serverErrors={errosReagendamento} submitLabel="Confirmar novo agendamento" onSubmit={salvarReagendamento} onCancel={fecharReagendamento} />
      </DialogOverlay>}
    </div>
  );
}