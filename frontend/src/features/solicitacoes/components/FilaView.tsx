import { Link } from 'react-router-dom';
import { PrioridadeBadge, StatusBadge } from '../../../components/Badge';
import { formatarAgendamento } from '../config/agendamento';
import { deslocarDataIso } from '../hooks/useAgendaSemanal';
import { AgendaView } from './AgendaView';
import { SolicitacoesToolbar } from './SolicitacoesToolbar';
import { LABEL_CATEGORIA, LABEL_TURNO } from '../types';
import type { Status, SolicitacaoListItem, SolicitacoesConsulta } from '../types';
import type { AgendaDiaEstado } from '../hooks/useAgendaSemanal';

export type VisaoPrincipal = 'fila' | 'agenda' | 'historico' | 'faltas';

type ReturnContext = { state: { from: string } };
type ListaResultado = { data: SolicitacaoListItem[]; total: number; last_page: number } | null;

interface FilaViewProps {
  emAgenda: boolean;
  visao: VisaoPrincipal;
  escopo: 'aberto' | 'encerrado';
  data: ListaResultado;
  loading: boolean;
  error: string | null;
  reload: () => void;
  consulta: SolicitacoesConsulta;
  page: number;
  setPage: (proxima: number | ((atual: number) => number)) => void;
  statusDisponiveis: Status[];
  filaFiltradaPorAgendada: boolean;
  dataFilaAgendada: string;
  onDataFilaAgendada: (data: string) => void;
  hasFilters: boolean;
  dataAgenda: string;
  diasDaAgenda: string[];
  gruposAgenda: Record<string, AgendaDiaEstado>;
  returnContext: ReturnContext;
  onChangeView: (view: VisaoPrincipal) => void;
  onChangeWeek: (dias: number) => void;
  onApply: (patch: Partial<SolicitacoesConsulta>) => void;
  onClear: () => void;
  onReloadAgenda: () => void;
  onChangeAgendaPage: (dia: string, pagina: number) => void;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}

export function FilaView(props: FilaViewProps) {
  const {
    emAgenda, visao, escopo, data, loading, error, reload, consulta, page, setPage,
    statusDisponiveis, filaFiltradaPorAgendada, dataFilaAgendada, onDataFilaAgendada,
    hasFilters, dataAgenda, diasDaAgenda, gruposAgenda, returnContext, onChangeView,
    onChangeWeek, onApply, onClear, onReloadAgenda, onChangeAgendaPage,
  } = props;
  const mudarSemana = onChangeWeek;
  const mudarVisao = onChangeView;
  const mudarPaginaDia = onChangeAgendaPage;
  const reloadAgenda = onReloadAgenda;
  const setDataFilaAgendada = onDataFilaAgendada;
  const aplicarFiltros = onApply;
  const clearFilters = onClear;
  return (
      <section className="panel queue-panel" aria-labelledby="list-heading">
        <div className="panel__header">
          <div>
            <p className="eyebrow">{emAgenda ? 'Agenda operacional' : escopo === 'aberto' ? 'Fila operacional' : 'Registros concluídos ou cancelados'}</p>
            <h2 id="list-heading">{emAgenda ? 'Solicitações agendadas' : escopo === 'aberto' ? 'Fila de atendimento' : 'Histórico'}</h2>
          </div>
          {emAgenda
            ? <span className="record-count">{diasDaAgenda.reduce((total, dia) => total + (gruposAgenda[dia]?.total ?? 0), 0)} no total</span>
            : data && !loading && !error && <span className="record-count">{data.total} no total</span>}
        </div>

        <div className="view-switcher" aria-label="Visão da fila">
          <div className="view-switcher__group" role="group" aria-label="Escopo da listagem">
            <button type="button" className={`button button--outline ${visao === 'fila' ? 'is-active' : ''}`} aria-pressed={visao === 'fila'} onClick={() => mudarVisao('fila')}>Fila atual</button>
            <button type="button" className={`button button--outline ${emAgenda ? 'is-active' : ''}`} aria-pressed={emAgenda} onClick={() => mudarVisao('agenda')}>Solicitações agendadas</button>
            <button type="button" className={`button button--outline ${visao === 'historico' ? 'is-active' : ''}`} aria-pressed={visao === 'historico'} onClick={() => mudarVisao('historico')}>Histórico</button>
            <button type="button" className="button button--outline" aria-pressed={false} onClick={() => mudarVisao('faltas')}>Faltas</button>
          </div>
        </div>

        {emAgenda && (
          <div className="agenda-week-nav" aria-label="Navegar pelas semanas">
            <button type="button" className="button button--outline" onClick={() => mudarSemana(-7)}>Semana anterior</button>
            <p><strong>{formatDate(`${dataAgenda}T12:00:00Z`)}</strong> – <strong>{formatDate(`${deslocarDataIso(dataAgenda, 6)}T12:00:00Z`)}</strong></p>
            <button type="button" className="button button--outline" onClick={() => mudarSemana(7)}>Próxima semana</button>
          </div>
        )}

        <SolicitacoesToolbar
          consulta={consulta}
          opcoesOrdenacao={emAgenda ? ['horario', 'prioridade'] : filaFiltradaPorAgendada ? (dataFilaAgendada ? ['horario', 'prioridade'] : ['horario', 'prioridade', 'data']) : ['prioridade', 'data']}
          ordenacaoPadrao={emAgenda || filaFiltradaPorAgendada ? 'horario' : escopo === 'aberto' ? 'prioridade' : 'data'}
          direcaoPadrao={escopo === 'encerrado' ? 'desc' : 'asc'}
          total={emAgenda ? diasDaAgenda.reduce((total, dia) => total + (gruposAgenda[dia]?.total ?? 0), 0) : data?.total ?? 0}
          mostrarStatus={!emAgenda}
          statusDisponiveis={statusDisponiveis}
          mostrarCategoria
          mostrarPrioridade
          mostrarPeriodo
          onApply={aplicarFiltros}
          onClear={clearFilters}
        />

        {filaFiltradaPorAgendada && (
          <div className="filter-field agenda-date-field">
            <label htmlFor="filtro-data-fila">Data agendada</label>
            <input id="filtro-data-fila" type="date" value={dataFilaAgendada} onChange={event => setDataFilaAgendada(event.target.value)} />
          </div>
        )}

        {!emAgenda && loading && (
          <div className="state-view" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <strong>Carregando solicitações</strong>
          </div>
        )}

        {!emAgenda && error && (
          <div className="alert alert--error" role="alert">
            <div>
              <strong>Não foi possível carregar a listagem</strong>
              <p>{error}</p>
            </div>
            <button onClick={reload} className="button button--outline" type="button">Tentar novamente</button>
          </div>
        )}

        {!emAgenda && !loading && !error && (data?.data?.length ?? -1) === 0 && (
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

        {!emAgenda && !loading && !error && data && (data.data?.length ?? 0) > 0 && (
          <>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabela de solicitações; use as setas para rolar horizontalmente">
              <table className="requests-table">
                <caption className="sr-only">Solicitações de atendimento encontradas</caption>
                <thead>
                  <tr>
                    <th scope="col">Prioridade</th>
                    <th scope="col">Solicitação</th>
                    <th scope="col">Categoria</th>
                    <th scope="col">Etapa</th>
                    <th scope="col">{emAgenda ? 'Agendado para' : 'Data'}</th>
                    <th scope="col"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.data?.map(request => (
                    <tr key={request.id}>
                      <td data-label="Prioridade"><PrioridadeBadge prioridade={request.prioridade} /></td>
                      <td data-label="Solicitação">
                        <Link to={`/solicitacoes/${request.id}`} {...returnContext} className="protocol-link">{request.protocolo}</Link>
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
                        <Link to={`/solicitacoes/${request.id}`} {...returnContext} className="button button--outline button--small" aria-label={`Ver detalhes da solicitação ${request.protocolo}`}>
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

        {emAgenda && <AgendaView
          dias={diasDaAgenda}
          grupos={gruposAgenda}
          paginas={consulta.agendaPages ?? {}}
          returnContext={returnContext}
          onReload={reloadAgenda}
          onPageChange={mudarPaginaDia}
        />}
      </section>
  );
}
