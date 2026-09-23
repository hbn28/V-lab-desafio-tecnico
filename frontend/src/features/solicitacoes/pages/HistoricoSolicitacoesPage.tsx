import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSolicitacoes } from '../hooks/useSolicitacoes';
import { ViewSwitcher } from '../components/ViewSwitcher';
import { SolicitacoesTable } from '../components/SolicitacoesTable';
import type { Status, Categoria, Prioridade } from '../types';
import { LABEL_STATUS, LABEL_CATEGORIA, LABEL_PRIORIDADE } from '../types';

const CATEGORIA_LIST: Categoria[] = ['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO'];
const PRIORIDADE_LIST: Prioridade[] = ['URGENTE', 'ALTA', 'MEDIA', 'BAIXA'];
/** As duas únicas etapas finais — as mesmas que definem "encerrado" no restante do sistema. */
const STATUS_ENCERRADO: Status[] = ['CONCLUIDA', 'CANCELADA'];

/**
 * Histórico encerrado em página própria, separado do painel operacional (fila/agenda/faltas):
 * uma solicitação concluída ou cancelada não é mais um item a agir, então não compete por
 * espaço com "Prioridades em aberto" nem com a "Próxima solicitação por prioridade" — os dois
 * cartões que só fazem sentido para o que ainda está em aberto.
 */
export function HistoricoSolicitacoesPage() {
  const [status, setStatus] = useState<Status | ''>('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [prioridade, setPrioridade] = useState<Prioridade | ''>('');
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useSolicitacoes({
    status: status || undefined,
    categoria: categoria || undefined,
    prioridade: prioridade || undefined,
    status_grupo: 'encerrado',
    page,
    per_page: 10,
  });

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
          <p className="eyebrow">Ordem operacional</p>
          <h1>Histórico encerrado</h1>
          <p className="page-heading__description">
            Solicitações concluídas e canceladas, do encerramento mais recente ao mais antigo — fora
            do painel de atendimento em aberto.
          </p>
        </div>
        <Link to="/solicitacoes/nova" className="button button--primary">
          <span aria-hidden="true">＋</span>
          Nova solicitação
        </Link>
      </header>

      <section className="panel queue-panel" aria-labelledby="historico-heading">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Histórico</p>
            <h2 id="historico-heading">Solicitações encerradas</h2>
            <p className="list-order-hint">Concluídas e canceladas, do encerramento mais recente ao mais antigo.</p>
          </div>
          {data && !loading && !error && <span className="record-count">{data.total} no total</span>}
        </div>

        <div className="view-switcher" aria-label="Visão da fila">
          <ViewSwitcher ativo="historico" />
        </div>

        <div className="filter-bar" aria-label="Filtros do histórico">
          <div className="filter-field">
            <label htmlFor="historico-filtro-status">Status</label>
            <select id="historico-filtro-status" value={status} onChange={event => { setStatus(event.target.value as Status | ''); setPage(1); }}>
              <option value="">Todos</option>
              {STATUS_ENCERRADO.map(item => <option key={item} value={item}>{LABEL_STATUS[item]}</option>)}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="historico-filtro-categoria">Categoria</label>
            <select id="historico-filtro-categoria" value={categoria} onChange={event => { setCategoria(event.target.value as Categoria | ''); setPage(1); }}>
              <option value="">Todas</option>
              {CATEGORIA_LIST.map(item => <option key={item} value={item}>{LABEL_CATEGORIA[item]}</option>)}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="historico-filtro-prioridade">Prioridade</label>
            <select id="historico-filtro-prioridade" value={prioridade} onChange={event => { setPrioridade(event.target.value as Prioridade | ''); setPage(1); }}>
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

        <SolicitacoesTable
          data={data}
          loading={loading}
          error={error}
          onReload={reload}
          page={page}
          onPageChange={setPage}
          colunaQuinta="Data"
          loadingLabel="Carregando histórico"
          empty={{
            titulo: hasFilters ? 'Nenhum resultado para estes filtros' : 'Nenhuma solicitação encerrada ainda',
            descricao: hasFilters ? 'Revise ou limpe os filtros para ampliar a busca.' : 'Concluídas e canceladas aparecem aqui assim que forem encerradas.',
            acao: hasFilters ? (
              <button className="button button--outline" type="button" onClick={clearFilters}>Limpar filtros</button>
            ) : undefined,
          }}
        />
      </section>
    </div>
  );
}
