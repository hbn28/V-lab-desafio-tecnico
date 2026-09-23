import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge, PrioridadeBadge } from '../../../components/Badge';
import { formatarAgendamento } from '../config/agendamento';
import { LABEL_CATEGORIA, LABEL_TURNO } from '../types';
import type { Solicitacao } from '../types';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}

export interface ListaPaginada {
  data: Solicitacao[];
  total: number;
  last_page: number;
}

export interface EstadoVazio {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}

interface SolicitacoesTableProps {
  data: ListaPaginada | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  page: number;
  onPageChange: (atualizar: (atual: number) => number) => void;
  /** Cabeçalho da 5ª coluna — "Agendado para" na Agenda, "Data" nas demais visões. */
  colunaQuinta: string;
  empty: EstadoVazio;
  loadingLabel?: string;
}

/**
 * Tabela de solicitações com estados de carregando/erro/vazio e paginação — compartilhada
 * entre a fila/agenda (SolicitacoesPage) e o Histórico encerrado (HistoricoSolicitacoesPage),
 * para as duas listagens ficarem sempre com a mesma cara e o mesmo comportamento.
 */
export function SolicitacoesTable({
  data,
  loading,
  error,
  onReload,
  page,
  onPageChange,
  colunaQuinta,
  empty,
  loadingLabel = 'Carregando solicitações',
}: SolicitacoesTableProps) {
  return (
    <>
      {loading && (
        <div className="state-view" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <strong>{loadingLabel}</strong>
          <p>Buscando os registros mais recentes.</p>
        </div>
      )}

      {error && (
        <div className="alert alert--error" role="alert">
          <div>
            <strong>Não foi possível carregar a listagem</strong>
            <p>{error}</p>
          </div>
          <button onClick={onReload} className="button button--outline" type="button">Tentar novamente</button>
        </div>
      )}

      {!loading && !error && (data?.data?.length ?? -1) === 0 && (
        <div className="state-view">
          <span className="state-view__icon" aria-hidden="true">○</span>
          <strong>{empty.titulo}</strong>
          <p>{empty.descricao}</p>
          {empty.acao}
        </div>
      )}

      {!loading && !error && data && (data.data?.length ?? 0) > 0 && (
        <>
          <div className="table-wrap">
            <table className="requests-table">
              <caption className="sr-only">Solicitações de atendimento encontradas</caption>
              <thead>
                <tr>
                  <th scope="col">Prioridade</th>
                  <th scope="col">Solicitação</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Etapa</th>
                  <th scope="col">{colunaQuinta}</th>
                  <th scope="col"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {data.data?.map(request => (
                  <tr key={request.id}>
                    <td data-label="Prioridade"><PrioridadeBadge prioridade={request.prioridade} /></td>
                    <td data-label="Solicitação">
                      <Link to={`/solicitacoes/${request.id}`} className="protocol-link">{request.protocolo}</Link>
                      <span className="requester-name">{request.nome_solicitante}</span>
                    </td>
                    <td data-label="Categoria">{LABEL_CATEGORIA[request.categoria]}</td>
                    <td data-label="Etapa"><StatusBadge status={request.status} /></td>
                    {request.agendado_para ? (
                      <td data-label="Agendado para"><time dateTime={request.agendado_para}>{formatarAgendamento(request.agendado_para)}</time></td>
                    ) : request.agendamento_ativo?.modalidade === 'TURNO' && request.agendamento_ativo.turno ? (
                      <td data-label="Turno">{LABEL_TURNO[request.agendamento_ativo.turno]}</td>
                    ) : (
                      <td data-label="Registrada em"><time dateTime={request.data_criacao}>{formatDate(request.data_criacao)}</time></td>
                    )}
                    <td data-label="Ações">
                      <Link to={`/solicitacoes/${request.id}`} className="button button--outline button--small" aria-label={`Ver detalhes da solicitação ${request.protocolo}`}>
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav className="pagination" aria-label="Paginação da fila">
            <p>Página <strong>{page}</strong> de <strong>{data.last_page}</strong></p>
            <div className="pagination__actions">
              <button className="button button--outline" disabled={page === 1} onClick={() => onPageChange(atual => atual - 1)} type="button">
                Anterior
              </button>
              <button className="button button--outline" disabled={page === data.last_page} onClick={() => onPageChange(atual => atual + 1)} type="button">
                Próxima
              </button>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
