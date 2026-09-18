import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSolicitacoes, useResumoSolicitacoes } from '../hooks/useSolicitacoes';
import { StatusBadge, PrioridadeBadge } from '../../../components/Badge';
import { DrilldownModal } from '../components/DrilldownModal';
import type { Status, Categoria, Prioridade } from '../types';
import type { FiltrosSolicitacoes } from '../types';
import { LABEL_STATUS, LABEL_CATEGORIA, LABEL_PRIORIDADE } from '../types';

const STATUS_LIST: Status[] = ['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA'];
const STATUS_ABERTO_LIST = ['RECEBIDA', 'EM_ANALISE', 'AGENDADA'] as const satisfies readonly Status[];
const CATEGORIA_LIST: Categoria[] = ['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO'];
const PRIORIDADE_LIST: Prioridade[] = ['URGENTE', 'ALTA', 'MEDIA', 'BAIXA'];

const STATUS_ARIA: Record<Status, [string, string]> = {
  RECEBIDA: ['solicitação recebida', 'solicitações recebidas'],
  EM_ANALISE: ['solicitação em análise', 'solicitações em análise'],
  AGENDADA: ['solicitação agendada', 'solicitações agendadas'],
  CONCLUIDA: ['solicitação concluída', 'solicitações concluídas'],
  CANCELADA: ['solicitação cancelada', 'solicitações canceladas'],
};

const PRIORIDADE_ARIA: Record<Prioridade, [string, string]> = {
  URGENTE: ['solicitação urgente em aberto', 'solicitações urgentes em aberto'],
  ALTA: ['solicitação de prioridade alta em aberto', 'solicitações de prioridade alta em aberto'],
  MEDIA: ['solicitação de prioridade média em aberto', 'solicitações de prioridade média em aberto'],
  BAIXA: ['solicitação de prioridade baixa em aberto', 'solicitações de prioridade baixa em aberto'],
};

const LABEL_STATUS_ABERTO: Record<(typeof STATUS_ABERTO_LIST)[number], string> = {
  RECEBIDA: 'Recebidas',
  EM_ANALISE: 'Em análise',
  AGENDADA: 'Agendadas',
};

const PRIORIDADE_ACCENT: Record<Prioridade, 'urgente' | 'alta' | 'media' | 'baixa'> = {
  URGENTE: 'urgente',
  ALTA: 'alta',
  MEDIA: 'media',
  BAIXA: 'baixa',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}

interface Drilldown {
  title: string;
  description: string;
  accent: 'urgente' | 'alta' | 'media' | 'baixa' | 'neutro';
  filtros: FiltrosSolicitacoes;
}

export function SolicitacoesPage() {
  const [status, setStatus] = useState<Status | ''>('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [prioridade, setPrioridade] = useState<Prioridade | ''>('');
  const [page, setPage] = useState(1);
  const [drilldown, setDrilldown] = useState<Drilldown | null>(null);

  const { data, loading, error, reload } = useSolicitacoes({
    status: status || undefined,
    categoria: categoria || undefined,
    prioridade: prioridade || undefined,
    page,
    per_page: 10,
  });

  const resumoFiltros = { categoria: categoria || undefined, prioridade: prioridade || undefined };
  const { data: resumo, loading: resumoLoading, error: resumoError } = useResumoSolicitacoes(resumoFiltros);

  const hasFilters = Boolean(status || categoria || prioridade);

  const clearFilters = () => {
    setStatus('');
    setCategoria('');
    setPrioridade('');
    setPage(1);
  };

  const abrirPorPrioridade = (item: Prioridade) => {
    const count = resumo?.prioridade_aberta[item] ?? 0;
    setDrilldown({
      title: `${LABEL_PRIORIDADE[item]} em aberto`,
      description: `${count} ${count === 1 ? PRIORIDADE_ARIA[item][0] : PRIORIDADE_ARIA[item][1]}`,
      accent: PRIORIDADE_ACCENT[item],
      // A contagem do cartão não é afetada pelo filtro de prioridade da listagem
      // (é a própria dimensão detalhada), então o drill-down também não aplica.
      filtros: { prioridade: item, status_grupo: 'aberto', categoria: categoria || undefined },
    });
  };

  const abrirPorStatus = (item: (typeof STATUS_ABERTO_LIST)[number]) => {
    const count = resumo?.status[item] ?? 0;
    setDrilldown({
      title: LABEL_STATUS_ABERTO[item],
      description: `${count} ${count === 1 ? STATUS_ARIA[item][0] : STATUS_ARIA[item][1]}`,
      accent: 'neutro',
      filtros: { status: item, categoria: categoria || undefined, prioridade: prioridade || undefined },
    });
  };

  const encerradasTotal = (resumo?.status.CONCLUIDA ?? 0) + (resumo?.status.CANCELADA ?? 0);

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

      {!resumoLoading && !resumoError && resumo && (
        <p className="dashboard-context" role="status">
          {resumoFiltros.categoria || resumoFiltros.prioridade ? (
            <>
              Painel considerando <strong>
                {[
                  resumoFiltros.categoria && `categoria ${LABEL_CATEGORIA[resumoFiltros.categoria]}`,
                  resumoFiltros.prioridade && `prioridade ${LABEL_PRIORIDADE[resumoFiltros.prioridade]}`,
                ].filter(Boolean).join(' e ')}
              </strong>, como na listagem abaixo.
            </>
          ) : (
            <>Painel considerando <strong>todas as solicitações</strong> — não apenas as desta página.</>
          )}
          {status && ' O filtro de status da listagem não muda estes números: cada bloco já é a sua própria quebra por status ou prioridade.'}
        </p>
      )}

      {!resumoLoading && !resumoError && resumo && (
        <section className="dashboard-section" aria-labelledby="priority-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Atenção imediata</p>
              <h2 id="priority-heading">Prioridades em aberto</h2>
            </div>
            <p>Toque em um bloco para ver as solicitações</p>
          </div>
          <div className="priority-grid">
            {PRIORIDADE_LIST.map(item => {
              const count = resumo.prioridade_aberta[item];
              const description = count === 1 ? PRIORIDADE_ARIA[item][0] : PRIORIDADE_ARIA[item][1];
              return (
                <button
                  type="button"
                  className={`priority-card priority-card--${item.toLowerCase()}`}
                  key={item}
                  aria-label={`${count} ${description}. Ver lista.`}
                  onClick={() => abrirPorPrioridade(item)}
                >
                  <span className="priority-card__label">{LABEL_PRIORIDADE[item]}</span>
                  <strong>{count}</strong>
                  <span className="priority-card__action">Em aberto ›</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!resumoLoading && !resumoError && resumo && (
        <section className="workflow-section" aria-labelledby="workflow-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Fluxo de trabalho</p>
              <h2 id="workflow-heading">Andamento da fila</h2>
            </div>
            <p>{encerradasTotal} encerrada{encerradasTotal === 1 ? '' : 's'} no total</p>
          </div>
          <dl className="workflow-list">
            {STATUS_ABERTO_LIST.map(item => (
              <div key={item}>
                <button
                  type="button"
                  className="workflow-list__trigger"
                  onClick={() => abrirPorStatus(item)}
                  aria-label={`${resumo.status[item]} ${resumo.status[item] === 1 ? STATUS_ARIA[item][0] : STATUS_ARIA[item][1]}. Ver lista.`}
                >
                  <dt>{LABEL_STATUS_ABERTO[item]}</dt>
                  <dd>{resumo.status[item]}</dd>
                </button>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="panel" aria-labelledby="list-heading">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Fila de solicitações</p>
            <h2 id="list-heading">Registros</h2>
            <p className="list-order-hint">Prioridade mais alta primeiro; em caso de empate, a solicitação mais antiga.</p>
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
                    <th scope="col">Prioridade</th>
                    <th scope="col">Solicitação</th>
                    <th scope="col">Categoria</th>
                    <th scope="col">Etapa</th>
                    <th scope="col">Registrada em</th>
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
                      <td data-label="Registrada em"><time dateTime={request.data_criacao}>{formatDate(request.data_criacao)}</time></td>
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

      {drilldown && (
        <DrilldownModal
          title={drilldown.title}
          description={drilldown.description}
          accent={drilldown.accent}
          filtros={drilldown.filtros}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  );
}
