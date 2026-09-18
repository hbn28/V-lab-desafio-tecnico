import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSolicitacoes } from '../hooks/useSolicitacoes';
import { StatusBadge, PrioridadeBadge } from '../../../components/Badge';
import type { Status, Categoria, Prioridade } from '../types';
import { LABEL_STATUS, LABEL_CATEGORIA, LABEL_PRIORIDADE } from '../types';

const STATUS_LIST: Status[] = ['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA'];
const CATEGORIA_LIST: Categoria[] = ['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO'];
const PRIORIDADE_LIST: Prioridade[] = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'];

const STATUS_ARIA: Record<Status, [string, string]> = {
  RECEBIDA: ['solicitação recebida', 'solicitações recebidas'],
  EM_ANALISE: ['solicitação em análise', 'solicitações em análise'],
  AGENDADA: ['solicitação agendada', 'solicitações agendadas'],
  CONCLUIDA: ['solicitação concluída', 'solicitações concluídas'],
  CANCELADA: ['solicitação cancelada', 'solicitações canceladas'],
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}

export function SolicitacoesPage() {
  const [status, setStatus] = useState<Status | ''>('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [prioridade, setPrioridade] = useState<Prioridade | ''>('');
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useSolicitacoes({
    status: status || undefined,
    categoria: categoria || undefined,
    prioridade: prioridade || undefined,
    page,
    per_page: 10,
  });

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_LIST.map(item => [item, 0])) as Record<Status, number>;
    data?.data?.forEach(item => { counts[item.status] += 1; });
    return counts;
  }, [data]);

  const hasFilters = Boolean(status || categoria || prioridade);

  const clearFilters = () => {
    setStatus('');
    setCategoria('');
    setPrioridade('');
    setPage(1);
  };

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Painel de atendimento</p>
          <h1>Solicitações de Atendimento</h1>
          <p className="page-heading__description">
            Acompanhe a fila, priorize demandas e mantenha cada atendimento no fluxo correto.
          </p>
        </div>
        <Link to="/solicitacoes/nova" className="button button--primary">
          <span aria-hidden="true">＋</span>
          Nova solicitação
        </Link>
      </header>

      {!loading && !error && data && (
        <section className="summary-section" aria-labelledby="summary-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Visão operacional</p>
              <h2 id="summary-heading">Resumo desta página</h2>
            </div>
            <p>{data?.data?.length ?? 0} de {data?.total ?? 0} solicitações</p>
          </div>
          <div className="summary-grid">
            {STATUS_LIST.map(item => {
              const count = statusCounts[item];
              const description = count === 1 ? STATUS_ARIA[item][0] : STATUS_ARIA[item][1];
              return (
                <article
                  className={`summary-card summary-card--${item.toLowerCase()}`}
                  key={item}
                  aria-label={`${count} ${description}`}
                >
                  <span className="summary-card__label">{LABEL_STATUS[item]}</span>
                  <strong>{count}</strong>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="list-heading">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Fila de solicitações</p>
            <h2 id="list-heading">Registros</h2>
          </div>
          {data && !loading && !error && <span className="record-count">{data.total} no total</span>}
        </div>

        <div className="filter-bar" aria-label="Filtros da listagem">
          <div className="filter-field">
            <label htmlFor="filtro-status">Status</label>
            <select id="filtro-status" value={status} onChange={event => { setStatus(event.target.value as Status | ''); setPage(1); }}>
              <option value="">Todos</option>
              {STATUS_LIST.map(item => <option key={item} value={item}>{LABEL_STATUS[item]}</option>)}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="filtro-categoria">Categoria</label>
            <select id="filtro-categoria" value={categoria} onChange={event => { setCategoria(event.target.value as Categoria | ''); setPage(1); }}>
              <option value="">Todas</option>
              {CATEGORIA_LIST.map(item => <option key={item} value={item}>{LABEL_CATEGORIA[item]}</option>)}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="filtro-prioridade">Prioridade</label>
            <select id="filtro-prioridade" value={prioridade} onChange={event => { setPrioridade(event.target.value as Prioridade | ''); setPage(1); }}>
              <option value="">Todas</option>
              {PRIORIDADE_LIST.map(item => <option key={item} value={item}>{LABEL_PRIORIDADE[item]}</option>)}
            </select>
          </div>
          {hasFilters && (
            <button className="button button--ghost filter-bar__clear" type="button" onClick={clearFilters}>
              Limpar filtros
            </button>
          )}
        </div>

        {loading && (
          <div className="state-view" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <strong>Carregando solicitações</strong>
            <p>Buscando os registros mais recentes.</p>
          </div>
        )}

        {error && (
          <div className="alert alert--error" role="alert">
            <div>
              <strong>Não foi possível carregar a listagem</strong>
              <p>{error}</p>
            </div>
            <button onClick={reload} className="button button--outline" type="button">Tentar novamente</button>
          </div>
        )}

        {!loading && !error && (data?.data?.length ?? -1) === 0 && (
          <div className="state-view">
            <span className="state-view__icon" aria-hidden="true">○</span>
            <strong>{hasFilters ? 'Nenhum resultado para estes filtros' : 'Nenhuma solicitação cadastrada'}</strong>
            <p>{hasFilters ? 'Revise ou limpe os filtros para ampliar a busca.' : 'Crie a primeira solicitação para iniciar o acompanhamento.'}</p>
            {hasFilters ? (
              <button className="button button--outline" type="button" onClick={clearFilters}>Limpar filtros</button>
            ) : (
              <Link to="/solicitacoes/nova" className="button button--outline">Criar solicitação</Link>
            )}
          </div>
        )}

        {!loading && !error && data && (data.data?.length ?? 0) > 0 && (
          <>
            <div className="table-wrap">
              <table className="requests-table">
                <caption className="sr-only">Solicitações de atendimento encontradas</caption>
                <thead>
                  <tr>
                    <th scope="col">Protocolo</th>
                    <th scope="col">Solicitante</th>
                    <th scope="col">Categoria</th>
                    <th scope="col">Prioridade</th>
                    <th scope="col">Status</th>
                    <th scope="col">Data</th>
                    <th scope="col"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.data?.map(request => (
                    <tr key={request.id}>
                      <td data-label="Protocolo">
                        <Link to={`/solicitacoes/${request.id}`} className="protocol-link">{request.protocolo}</Link>
                      </td>
                      <td data-label="Solicitante"><span className="requester-name">{request.nome_solicitante}</span></td>
                      <td data-label="Categoria">{LABEL_CATEGORIA[request.categoria]}</td>
                      <td data-label="Prioridade"><PrioridadeBadge prioridade={request.prioridade} /></td>
                      <td data-label="Status"><StatusBadge status={request.status} /></td>
                      <td data-label="Data"><time dateTime={request.data_criacao}>{formatDate(request.data_criacao)}</time></td>
                      <td data-label="Ações">
                        <Link to={`/solicitacoes/${request.id}`} className="button button--outline button--small" aria-label={`Gerenciar status da solicitação ${request.protocolo}`}>
                          Gerenciar status
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <nav className="pagination" aria-label="Paginação da listagem">
              <p>Página <strong>{page}</strong> de <strong>{data.last_page}</strong></p>
              <div className="pagination__actions">
                <button className="button button--outline" disabled={page === 1} onClick={() => setPage(current => current - 1)} type="button">
                  Anterior
                </button>
                <button className="button button--outline" disabled={page === data.last_page} onClick={() => setPage(current => current + 1)} type="button">
                  Próxima
                </button>
              </div>
            </nav>
          </>
        )}
      </section>
    </div>
  );
}
