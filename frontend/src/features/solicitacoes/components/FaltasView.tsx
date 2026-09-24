import { useState } from 'react';
import { useFaltas } from '../hooks/useSolicitacoes';
import { solicitacoesApi } from '../api/client';
import { ViewSwitcher } from './ViewSwitcher';
import { FaltaCard } from './FaltaCard';
import { ContatoFaltaDialog } from './ContatoFaltaDialog';
import { AgendamentoForm } from './AgendamentoForm';
import type { AgendamentoPayload, FaltaListItem, ResultadoContato } from '../types';

function errosDeValidacao(caught: unknown): Record<string, string[]> {
  return caught instanceof Error && 'errors' in caught
    ? ((caught as Error & { errors?: Record<string, string[]> }).errors ?? {})
    : {};
}

/**
 * Aba "Faltas": agendamentos em que o paciente não compareceu e que ainda pedem ação
 * (contato ou reagendamento). A API só devolve faltas pendentes — uma falta reagendada,
 * cancelada ou concluída sai da lista, mas continua no histórico do agendamento.
 */
export function FaltasView() {
  const { data: faltas, loading, error, reload } = useFaltas();

  const [faltaContato, setFaltaContato] = useState<FaltaListItem | null>(null);
  const [enviandoContato, setEnviandoContato] = useState(false);
  const [erroContato, setErroContato] = useState<string | null>(null);

  const [faltaReagendando, setFaltaReagendando] = useState<FaltaListItem | null>(null);
  const [salvandoReagendamento, setSalvandoReagendamento] = useState(false);
  const [errosReagendamento, setErrosReagendamento] = useState<Record<string, string[]>>({});
  const [erroReagendamento, setErroReagendamento] = useState<string | null>(null);

  const [sucesso, setSucesso] = useState<string | null>(null);

  const abrirContato = (falta: FaltaListItem) => { setErroContato(null); setSucesso(null); setFaltaContato(falta); };
  const salvarContato = async (resultado: ResultadoContato) => {
    if (!faltaContato) return;
    setEnviandoContato(true);
    setErroContato(null);
    try {
      await solicitacoesApi.registrarContato(faltaContato.id, { resultado });
      setFaltaContato(null);
      setSucesso('Tentativa de contato registrada.');
      await reload();
    } catch (caught: unknown) {
      setErroContato(caught instanceof Error ? caught.message : 'Erro ao registrar contato');
    } finally {
      setEnviandoContato(false);
    }
  };

  const abrirReagendamento = (falta: FaltaListItem) => {
    setErrosReagendamento({});
    setErroReagendamento(null);
    setSucesso(null);
    setFaltaReagendando(falta);
  };
  const salvarReagendamento = async (payload: AgendamentoPayload) => {
    if (!faltaReagendando) return;
    setSalvandoReagendamento(true);
    setErrosReagendamento({});
    setErroReagendamento(null);
    try {
      await solicitacoesApi.reagendarAposFalta(faltaReagendando.id, payload);
      setFaltaReagendando(null);
      setSucesso('Novo agendamento confirmado. A falta anterior segue registrada no histórico.');
      await reload();
    } catch (caught: unknown) {
      const erros = errosDeValidacao(caught);
      if (Object.keys(erros).length > 0) {
        setErrosReagendamento(erros);
      } else {
        // 409 (a falta já foi tratada em outra sessão) e falhas de rede também precisam aparecer.
        setErroReagendamento(caught instanceof Error ? caught.message : 'Erro ao reagendar após a falta');
      }
    } finally {
      setSalvandoReagendamento(false);
    }
  };

  const lista = faltas?.data ?? [];

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Ausências</p>
          <h1>Faltas</h1>
          <p className="page-heading__description">
            Pacientes que faltaram ao atendimento agendado — registre o contato ou reagende.
            A falta é registrada no detalhe da solicitação, depois do horário ou do fim do turno.
          </p>
        </div>
      </header>

      <div className="view-switcher" aria-label="Visão da fila">
        <ViewSwitcher ativo="faltas" />
      </div>

      {sucesso && <div className="alert alert--success alert--compact" role="status"><p>{sucesso}</p></div>}
      {erroContato && <div className="alert alert--error alert--compact" role="alert"><p>{erroContato}</p></div>}

      {loading && (
        <div className="state-view" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <strong>Carregando faltas</strong>
        </div>
      )}

      {error && (
        <div className="alert alert--error" role="alert">
          <div><strong>Não foi possível carregar as faltas</strong><p>{error}</p></div>
          <button onClick={reload} className="button button--outline" type="button">Tentar novamente</button>
        </div>
      )}

      {!loading && !error && lista.length === 0 && (
        <div className="state-view">
          <span className="state-view__icon" aria-hidden="true">○</span>
          <strong>Nenhuma falta pendente</strong>
        </div>
      )}

      {!loading && !error && lista.length > 0 && (
        <div className="faltas-list">
          {lista.map(falta => (
            <FaltaCard key={falta.id} falta={falta} onRegistrarContato={abrirContato} onReagendar={abrirReagendamento} />
          ))}
        </div>
      )}

      {faltaContato && (
        <ContatoFaltaDialog submitting={enviandoContato} onSalvar={salvarContato} onCancelar={() => setFaltaContato(null)} />
      )}

      {faltaReagendando && (
        <div className="dialog" role="dialog" aria-labelledby="reagendar-falta-heading">
          <h2 id="reagendar-falta-heading">Reagendar após falta</h2>
          {erroReagendamento && <div className="alert alert--error alert--compact" role="alert"><p>{erroReagendamento}</p></div>}
          <AgendamentoForm
            submitting={salvandoReagendamento}
            serverErrors={errosReagendamento}
            submitLabel="Confirmar novo agendamento"
            onSubmit={salvarReagendamento}
            onCancel={() => setFaltaReagendando(null)}
          />
        </div>
      )}
    </div>
  );
}
