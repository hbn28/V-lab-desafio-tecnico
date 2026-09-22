import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSolicitacao } from '../hooks/useSolicitacoes';
import { solicitacoesApi } from '../api/client';
import { StatusBadge, PrioridadeBadge } from '../../../components/Badge';
import { AgendamentoForm } from '../components/AgendamentoForm';
import { camposDoAgendamento, formatarAgendamento } from '../config/agendamento';
import { TRANSICOES_PERMITIDAS, LABEL_STATUS, LABEL_CATEGORIA } from '../types';
import type { AgendamentoPayload, Status } from '../types';

const MENSAGEM_CONFLITO = 'A solicitação mudou enquanto você editava. Revise o estado atual e tente novamente.';

function statusHttp(caught: unknown): number | undefined {
  return caught instanceof Error && 'status' in caught ? (caught as Error & { status?: number }).status : undefined;
}

function errosDaApi(caught: unknown): Record<string, string[]> {
  return caught instanceof Error && 'errors' in caught
    ? ((caught as Error & { errors?: Record<string, string[]> }).errors ?? {})
    : {};
}

function formatDate(value: string, includeTime = false) {
  const options: Intl.DateTimeFormatOptions = includeTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' };
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(value));
}

export function SolicitacaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error, reload, refresh } = useSolicitacao(id ?? '');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [editandoAgenda, setEditandoAgenda] = useState(false);
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);
  const [errosAgenda, setErrosAgenda] = useState<Record<string, string[]>>({});
  const abridorAgendaRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!data) return;
    if (!window.confirm(`Apagar a solicitação ${data.protocolo} definitivamente? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await solicitacoesApi.apagar(data.id.toString());
      navigate('/');
    } catch (caught: unknown) {
      setDeleteError(caught instanceof Error ? caught.message : 'Erro ao apagar solicitação');
      setDeleting(false);
    }
  };

  const handleStatusChange = async (novoStatus: Status) => {
    // AGENDADA exige data e hora: passa pelo formulário de agendamento, nunca por esta ação genérica.
    if (!data || novoStatus === 'AGENDADA') return;
    if (!window.confirm(`Confirmar mudança para "${LABEL_STATUS[novoStatus]}"?`)) return;
    setUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(null);
    try {
      await solicitacoesApi.atualizarStatus(data.id.toString(), { status: novoStatus });
      await reload();
      setUpdateSuccess(`Status atualizado para ${LABEL_STATUS[novoStatus]}.`);
    } catch (caught: unknown) {
      setUpdateError(caught instanceof Error ? caught.message : 'Erro ao atualizar status');
    } finally {
      setUpdating(false);
    }
  };

  const abrirAgenda = () => {
    setUpdateError(null);
    setUpdateSuccess(null);
    setErrosAgenda({});
    setEditandoAgenda(true);
  };

  const fecharAgenda = () => {
    setEditandoAgenda(false);
    setErrosAgenda({});
    // O botão que abriu o painel continua montado: devolve o foco a uma posição previsível.
    abridorAgendaRef.current?.focus();
  };

  const salvarAgenda = async (payload: AgendamentoPayload) => {
    if (!data) return;
    const reagendando = data.status === 'AGENDADA';
    setSalvandoAgenda(true);
    setErrosAgenda({});
    setUpdateError(null);
    setUpdateSuccess(null);
    try {
      if (reagendando) {
        await solicitacoesApi.reagendar(data.id.toString(), payload);
      } else {
        await solicitacoesApi.atualizarStatus(data.id.toString(), { status: 'AGENDADA', ...payload });
      }
      await refresh();
      setEditandoAgenda(false);
      setUpdateSuccess(reagendando ? 'Agendamento atualizado.' : 'Agendamento confirmado.');
    } catch (caught: unknown) {
      const http = statusHttp(caught);
      const erros = errosDaApi(caught);
      if (http === 409) {
        // Estado mudou em outra sessão: mantém os valores digitados e mostra o estado atual.
        setUpdateError(MENSAGEM_CONFLITO);
        await refresh();
      } else if (Object.keys(erros).length > 0) {
        setErrosAgenda(erros);
      } else {
        setUpdateError(caught instanceof Error ? caught.message : 'Erro ao salvar o agendamento');
      }
    } finally {
      setSalvandoAgenda(false);
    }
  };

  if (loading) {
    return (
      <div className="state-view state-view--page" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <strong>Carregando solicitação</strong>
        <p>Buscando os detalhes do atendimento.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert--error" role="alert">
        <div><strong>Não foi possível abrir esta solicitação</strong><p>{error}</p></div>
        <button onClick={reload} className="button button--outline" type="button">Tentar novamente</button>
      </div>
    );
  }

  if (!data) return null;

  const transicoes = TRANSICOES_PERMITIDAS[data.status];
  const details: Array<[string, ReactNode]> = [
    ['Protocolo', <span className="protocol" key="protocol">{data.protocolo}</span>],
    ['Solicitante', data.nome_solicitante],
    ['CPF', data.cpf_solicitante],
    ['Data de nascimento', formatDate(`${data.data_nascimento}T12:00:00`)],
    ['Categoria', LABEL_CATEGORIA[data.categoria]],
    ['Prioridade', <PrioridadeBadge key="priority" prioridade={data.prioridade} />],
    ['Status', <StatusBadge key="status" status={data.status} />],
  ];
  // Também em estados terminais: preserva o horário histórico.
  if (data.agendado_para) {
    details.push(['Agendado para', <time key="agendado" dateTime={data.agendado_para}>{formatarAgendamento(data.agendado_para)}</time>]);
  }

  return (
    <div className="page-stack">
      <nav className="breadcrumb" aria-label="Navegação estrutural">
        <Link to="/">Solicitações</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{data.protocolo}</span>
      </nav>

      <header className="page-heading page-heading--compact">
        <div>
          <p className="eyebrow">Detalhes do atendimento</p>
          <h1>{data.protocolo}</h1>
          <p className="page-heading__description">Consulte os dados cadastrados e avance o atendimento conforme o fluxo permitido.</p>
        </div>
        <div className="detail-header-actions">
          <StatusBadge status={data.status} />
          {transicoes.length > 0 && (
            <Link to={`/solicitacoes/${id}/editar`} className="button button--outline button--small">Editar</Link>
          )}
          <button onClick={handleDelete} disabled={deleting} className="button button--outline button--small button--danger-outline" type="button">
            {deleting ? 'Apagando...' : 'Apagar'}
          </button>
        </div>
      </header>

      {deleteError && (
        <div className="alert alert--error" role="alert">
          <p>{deleteError}</p>
        </div>
      )}

      <div className="detail-layout">
        <article className="panel detail-card" aria-labelledby="detail-heading">
          <div className="panel__header">
            <div><p className="eyebrow">Cadastro</p><h2 id="detail-heading">Informações da solicitação</h2></div>
          </div>
          <dl className="detail-list">
            {details.map(([label, value]) => (
              <div className="detail-list__row" key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>

          <div className="narrative-block">
            <h3>Descrição</h3>
            <p>{data.descricao}</p>
          </div>
          {data.justificativa_prioridade && (
            <div className="narrative-block narrative-block--urgent">
              <h3>Justificativa da prioridade</h3>
              <p>{data.justificativa_prioridade}</p>
            </div>
          )}

          <footer className="audit-info">
            <span>Criada em <time dateTime={data.data_criacao}>{formatDate(data.data_criacao, true)}</time></span>
            <span>Atualizada em <time dateTime={data.data_atualizacao}>{formatDate(data.data_atualizacao, true)}</time></span>
          </footer>
        </article>

        <aside className="panel status-panel" aria-labelledby="status-heading">
          <div className="panel__header panel__header--stacked">
            <div><p className="eyebrow">Fluxo do atendimento</p><h2 id="status-heading">Atualizar status</h2></div>
            <p>Estado atual: <strong>{LABEL_STATUS[data.status]}</strong></p>
          </div>

          {updateError && <div className="alert alert--error alert--compact" role="alert"><p>{updateError}</p></div>}
          {updateSuccess && <div className="alert alert--success alert--compact" role="status"><p>{updateSuccess}</p></div>}

          {transicoes.length === 0 ? (
            <div className="terminal-state">
              <strong>Fluxo encerrado</strong>
              <p>Esta solicitação está {data.status === 'CONCLUIDA' ? 'concluída' : 'cancelada'} e não permite novas alterações.</p>
            </div>
          ) : (
            <div className="status-actions">
              <p>Próximas ações permitidas</p>

              {data.status === 'AGENDADA' && data.agendado_para && (
                <div className="schedule-summary">
                  <p className="schedule-summary__label">Agendado para</p>
                  <p className="schedule-summary__value">
                    <time dateTime={data.agendado_para}>{formatarAgendamento(data.agendado_para)}</time>
                  </p>
                </div>
              )}

              {(data.status === 'EM_ANALISE' || data.status === 'AGENDADA') && (
                <button
                  ref={abridorAgendaRef}
                  type="button"
                  className="button button--status"
                  disabled={updating}
                  aria-expanded={editandoAgenda}
                  aria-controls="agendamento-painel"
                  onClick={abrirAgenda}
                >
                  <span>{data.status === 'AGENDADA' ? 'Alterar agendamento' : 'Agendar atendimento'}</span>
                  <span aria-hidden="true">→</span>
                </button>
              )}

              {editandoAgenda && (
                <div id="agendamento-painel">
                  <AgendamentoForm
                    key="agendamento-form"
                    mode={data.status === 'AGENDADA' ? 'reagendar' : 'agendar'}
                    initialValue={data.status === 'AGENDADA' && data.agendado_para ? camposDoAgendamento(data.agendado_para) : undefined}
                    submitting={salvandoAgenda}
                    serverErrors={errosAgenda}
                    context={
                      <p>
                        <strong>{data.protocolo}</strong> · {LABEL_CATEGORIA[data.categoria]} · <PrioridadeBadge prioridade={data.prioridade} />
                      </p>
                    }
                    onSubmit={salvarAgenda}
                    onCancel={fecharAgenda}
                  />
                </div>
              )}

              {transicoes.filter(status => status !== 'AGENDADA').map(status => (
                <button
                  key={status}
                  disabled={updating || salvandoAgenda}
                  onClick={() => handleStatusChange(status)}
                  className={`button button--status${status === 'CANCELADA' ? ' button--danger-outline' : ''}`}
                  type="button"
                >
                  <span>{updating ? 'Aguarde...' : `Mover para ${LABEL_STATUS[status]}`}</span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          )}

          <button onClick={() => navigate('/')} className="button button--ghost status-panel__back" type="button">Voltar à listagem</button>
        </aside>
      </div>
    </div>
  );
}
