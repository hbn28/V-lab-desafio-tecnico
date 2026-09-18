import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSolicitacao } from '../hooks/useSolicitacoes';
import { solicitacoesApi } from '../api/client';
import { StatusBadge, PrioridadeBadge } from '../../../components/Badge';
import { TRANSICOES_PERMITIDAS, LABEL_STATUS, LABEL_CATEGORIA } from '../types';
import type { Status } from '../types';

function formatDate(value: string, includeTime = false) {
  const options: Intl.DateTimeFormatOptions = includeTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' };
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(value));
}

export function SolicitacaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useSolicitacao(id ?? '');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
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
    if (!data) return;
    if (!window.confirm(`Confirmar mudança para "${LABEL_STATUS[novoStatus]}"?`)) return;
    setUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(null);
    try {
      await solicitacoesApi.atualizarStatus(data.id.toString(), novoStatus);
      await reload();
      setUpdateSuccess(`Status atualizado para ${LABEL_STATUS[novoStatus]}.`);
    } catch (caught: unknown) {
      setUpdateError(caught instanceof Error ? caught.message : 'Erro ao atualizar status');
    } finally {
      setUpdating(false);
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
  const details = [
    ['Protocolo', <span className="protocol" key="protocol">{data.protocolo}</span>],
    ['Solicitante', data.nome_solicitante],
    ['CPF', data.cpf_solicitante],
    ['Data de nascimento', formatDate(`${data.data_nascimento}T12:00:00`)],
    ['Categoria', LABEL_CATEGORIA[data.categoria]],
    ['Prioridade', <PrioridadeBadge key="priority" prioridade={data.prioridade} />],
    ['Status', <StatusBadge key="status" status={data.status} />],
  ] as const;

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
              {transicoes.map(status => (
                <button
                  key={status}
                  disabled={updating}
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
