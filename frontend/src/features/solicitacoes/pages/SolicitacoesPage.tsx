import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSolicitacoes, useResumoSolicitacoes, useProximaSolicitacao, useFaltas } from '../hooks/useSolicitacoes';
import { solicitacoesApi } from '../api/client';
import { StatusBadge, PrioridadeBadge } from '../../../components/Badge';
import { DrilldownModal } from '../components/DrilldownModal';
import { FaltaCard } from '../components/FaltaCard';
import { ContatoFaltaDialog } from '../components/ContatoFaltaDialog';
import { AgendamentoForm } from '../components/AgendamentoForm';
import { dataHojeNoFuso, dataIsoValida, formatarAgendamento } from '../config/agendamento';
import type { Status, Categoria, Prioridade } from '../types';
import type { AgendamentoPayload, FaltaListItem, FiltrosSolicitacoes, ResultadoContato } from '../types';
import { LABEL_STATUS, LABEL_CATEGORIA, LABEL_PRIORIDADE, LABEL_TURNO } from '../types';

const STATUS_LIST: Status[] = ['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA'];
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

const LABEL_STATUS_PLURAL: Record<Status, string> = {
  RECEBIDA: 'Recebidas',
  EM_ANALISE: 'Em análise',
  AGENDADA: 'Agendadas',
  CONCLUIDA: 'Concluídas',
  CANCELADA: 'Canceladas',
};

const STATUS_ENCERRADO = ['CONCLUIDA', 'CANCELADA'] as const satisfies readonly Status[];
type VisaoPrincipal = 'fila' | 'agenda' | 'historico' | 'faltas';
type ModoFila = 'prioridade' | 'categoria';

function visaoPelosParametros(searchParams: URLSearchParams): VisaoPrincipal {
  const parametro = searchParams.get('visao');
  if (parametro === 'agenda') return 'agenda';
  if (parametro === 'historico') return 'historico';
  if (parametro === 'faltas') return 'faltas';
  return 'fila';
}

const PRIORIDADE_ACCENT: Record<Prioridade, 'urgente' | 'alta' | 'media' | 'baixa'> = {
  URGENTE: 'urgente',
  ALTA: 'alta',
  MEDIA: 'media',
  BAIXA: 'baixa',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}

function formatAging(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'há poucos segundos';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias} dia${dias === 1 ? '' : 's'}`;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const visao = visaoPelosParametros(searchParams);
  // O fallback é calculado uma única vez: passar da meia-noite com a tela aberta não troca o dia consultado.
  const [dataAgendaPadrao] = useState(dataHojeNoFuso);
  const dataDaUrl = searchParams.get('data');
  const dataAgenda = dataIsoValida(dataDaUrl) ? dataDaUrl : dataAgendaPadrao;
  const [modo, setModo] = useState<ModoFila>('prioridade');
  const [page, setPage] = useState(1);
  const [drilldown, setDrilldown] = useState<Drilldown | null>(null);
  // Filtro de dia dentro da própria fila (ADR 003): só faz sentido com status=AGENDADA,
  // que é quando a ordenação passa a ser por horário em vez de prioridade.
  const [dataFilaAgendada, setDataFilaAgendada] = useState('');

  const emAgenda = visao === 'agenda';
  const emFaltas = visao === 'faltas';
  const escopo = visao === 'historico' ? 'encerrado' : 'aberto';
  const filaFiltradaPorAgendada = !emAgenda && status === 'AGENDADA';

  const { data: faltas, loading: faltasLoading, error: faltasError, reload: reloadFaltas } = useFaltas({ enabled: emFaltas });
  const [faltaContato, setFaltaContato] = useState<FaltaListItem | null>(null);
  const [enviandoContato, setEnviandoContato] = useState(false);
  const [erroContato, setErroContato] = useState<string | null>(null);
  const [faltaReagendando, setFaltaReagendando] = useState<FaltaListItem | null>(null);
  const [salvandoReagendamento, setSalvandoReagendamento] = useState(false);
  const [errosReagendamento, setErrosReagendamento] = useState<Record<string, string[]>>({});

  const abrirContato = (falta: FaltaListItem) => { setErroContato(null); setFaltaContato(falta); };
  const fecharContato = () => setFaltaContato(null);
  const salvarContato = async (resultado: ResultadoContato) => {
    if (!faltaContato) return;
    setEnviandoContato(true);
    setErroContato(null);
    try {
      await solicitacoesApi.registrarContato(faltaContato.id, { resultado });
      setFaltaContato(null);
      await reloadFaltas();
    } catch (caught: unknown) {
      setErroContato(caught instanceof Error ? caught.message : 'Erro ao registrar contato');
    } finally {
      setEnviandoContato(false);
    }
  };

  const abrirReagendamento = (falta: FaltaListItem) => { setErrosReagendamento({}); setFaltaReagendando(falta); };
  const fecharReagendamento = () => setFaltaReagendando(null);
  const salvarReagendamento = async (payload: AgendamentoPayload) => {
    if (!faltaReagendando) return;
    setSalvandoReagendamento(true);
    setErrosReagendamento({});
    try {
      await solicitacoesApi.reagendarAposFalta(faltaReagendando.id, payload);
      setFaltaReagendando(null);
      await reloadFaltas();
    } catch (caught: unknown) {
      const erros = caught instanceof Error && 'errors' in caught
        ? ((caught as Error & { errors?: Record<string, string[]> }).errors ?? {})
        : {};
      if (Object.keys(erros).length > 0) setErrosReagendamento(erros);
    } finally {
      setSalvandoReagendamento(false);
    }
  };

  // Data ausente ou inválida na URL da agenda é normalizada para o dia efetivamente consultado.
  useEffect(() => {
    if (visao === 'agenda' && searchParams.get('data') !== dataAgenda) {
      setSearchParams({ visao: 'agenda', data: dataAgenda }, { replace: true });
    }
  }, [dataAgenda, searchParams, setSearchParams, visao]);

  const { data, loading, error, reload } = useSolicitacoes(
    emAgenda
      ? {
          status: 'AGENDADA',
          data_agendada: dataAgenda,
          categoria: categoria || undefined,
          prioridade: prioridade || undefined,
          page,
          per_page: 10,
        }
      : {
          status: status || undefined,
          categoria: categoria || undefined,
          prioridade: prioridade || undefined,
          status_grupo: escopo,
          data_agendada: filaFiltradaPorAgendada && dataIsoValida(dataFilaAgendada) ? dataFilaAgendada : undefined,
          page,
          per_page: 10,
        }
  );

  const resumoFiltros = { categoria: categoria || undefined, prioridade: prioridade || undefined };
  const isDrilldownAberto = Boolean(drilldown);
  // A agenda não exibe o painel global nem a próxima solicitação: pausa a revalidação em segundo plano.
  const { data: resumo, loading: resumoLoading, error: resumoError } = useResumoSolicitacoes(resumoFiltros, { paused: isDrilldownAberto || emAgenda });
  // "Próxima solicitação por prioridade" é um fato operacional fixo (a #1 na ordem da fila, ADR 001) —
  // não muda com os filtros da listagem, que são só uma forma de explorar o resto da fila.
  const { data: proximo, loading: proximoLoading, error: proximoError } = useProximaSolicitacao({ paused: isDrilldownAberto || emAgenda });

  const hasFilters = Boolean(status || categoria || prioridade || dataFilaAgendada);
  const statusDisponiveis = escopo === 'aberto'
    ? STATUS_LIST.filter(item => !(STATUS_ENCERRADO as readonly Status[]).includes(item))
    : STATUS_ENCERRADO;

  const clearFilters = () => {
    setStatus('');
    setCategoria('');
    setPrioridade('');
    setDataFilaAgendada('');
    setPage(1);
  };

  const alterarStatus = (novoStatus: Status | '') => {
    setStatus(novoStatus);
    // A data só se aplica com status=AGENDADA (a API rejeita a combinação com outro status).
    if (novoStatus !== 'AGENDADA') setDataFilaAgendada('');
    setPage(1);
  };

  const mudarVisao = (novaVisao: VisaoPrincipal) => {
    setStatus('');
    setDataFilaAgendada('');
    setPage(1);
    if (novaVisao === 'agenda') setSearchParams({ visao: 'agenda', data: dataAgenda });
    else if (novaVisao === 'historico') setSearchParams({ visao: 'historico' });
    else if (novaVisao === 'faltas') setSearchParams({ visao: 'faltas' });
    else setSearchParams({});
  };

  const trocarDia = (novaData: string) => {
    if (!dataIsoValida(novaData)) return;
    setPage(1);
    setSearchParams({ visao: 'agenda', data: novaData });
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

  const abrirPorStatus = (item: Status) => {
    const count = resumo?.status[item] ?? 0;
    setDrilldown({
      title: LABEL_STATUS_PLURAL[item],
      description: `${count} ${count === 1 ? STATUS_ARIA[item][0] : STATUS_ARIA[item][1]}`,
      accent: 'neutro',
      filtros: { status: item, categoria: categoria || undefined, prioridade: prioridade || undefined },
    });
  };

  if (emFaltas) {
    return (
      <div className="page-stack">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Ausências</p>
            <h1>Faltas</h1>
            <p className="page-heading__description">
              Pacientes que faltaram ao atendimento agendado — registre o contato ou reagende.
            </p>
          </div>
        </header>

        <div className="view-switcher" aria-label="Visão da fila">
          <div className="view-switcher__group" role="group" aria-label="Escopo da listagem">
            <button type="button" className="button button--outline" onClick={() => mudarVisao('fila')}>Fila atual</button>
            <button type="button" className="button button--outline" onClick={() => mudarVisao('agenda')}>Agenda</button>
            <button type="button" className="button button--outline" onClick={() => mudarVisao('historico')}>Histórico encerrado</button>
            <button type="button" className="button button--outline is-active" aria-pressed="true" onClick={() => mudarVisao('faltas')}>Faltas</button>
          </div>
        </div>

        {erroContato && <div className="alert alert--error alert--compact" role="alert"><p>{erroContato}</p></div>}

        {faltasLoading && (
          <div className="state-view" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <strong>Carregando faltas</strong>
          </div>
        )}

        {faltasError && (
          <div className="alert alert--error" role="alert">
            <div><strong>Não foi possível carregar as faltas</strong><p>{faltasError}</p></div>
            <button onClick={reloadFaltas} className="button button--outline" type="button">Tentar novamente</button>
          </div>
        )}

        {!faltasLoading && !faltasError && (faltas?.data.length ?? 0) === 0 && (
          <div className="state-view">
            <span className="state-view__icon" aria-hidden="true">○</span>
            <strong>Nenhuma falta pendente</strong>
          </div>
        )}

        {!faltasLoading && !faltasError && faltas && faltas.data.length > 0 && (
          <div className="faltas-list">
            {faltas.data.map(falta => (
              <FaltaCard key={falta.id} falta={falta} onRegistrarContato={abrirContato} onReagendar={abrirReagendamento} />
            ))}
          </div>
        )}

        {faltaContato && (
          <ContatoFaltaDialog submitting={enviandoContato} onSalvar={salvarContato} onCancelar={fecharContato} />
        )}

        {faltaReagendando && (
          <div className="dialog" role="dialog" aria-labelledby="reagendar-falta-heading">
            <h2 id="reagendar-falta-heading">Reagendar após falta</h2>
            <AgendamentoForm
              submitting={salvandoReagendamento}
              serverErrors={errosReagendamento}
              submitLabel="Confirmar novo agendamento"
              onSubmit={salvarReagendamento}
              onCancel={fecharReagendamento}
            />
          </div>
        )}
      </div>
    );
  }

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

      {!emAgenda && !proximoLoading && !proximoError && (
        <section className="next-up" aria-labelledby="next-up-heading">
          <p className="eyebrow" id="next-up-heading">Próxima solicitação por prioridade</p>
          {proximo ? (
            <div className="next-up__content">
              <div className="next-up__info">
                <div className="next-up__badges">
                  <PrioridadeBadge prioridade={proximo.prioridade} />
                  <StatusBadge status={proximo.status} />
                </div>
                <p className="next-up__title">
                  <span className="protocol-link">{proximo.protocolo}</span>
                  <span className="requester-name">{proximo.nome_solicitante}</span>
                </p>
                <p className="next-up__meta">
                  {LABEL_CATEGORIA[proximo.categoria]} · esperando {formatAging(proximo.data_criacao)}
                </p>
              </div>
              <Link to={`/solicitacoes/${proximo.id}`} className="button button--primary next-up__action">
                Abrir solicitação ›
              </Link>
            </div>
          ) : (
            <p className="next-up__empty">Fila vazia — nada aguardando atendimento no momento.</p>
          )}
        </section>
      )}

      <section className="panel queue-panel" aria-labelledby="list-heading">
        <div className="panel__header">
          <div>
            <p className="eyebrow">{emAgenda ? 'Agenda operacional' : 'Ordem operacional'}</p>
            <h2 id="list-heading">{emAgenda ? 'Agenda do dia' : escopo === 'aberto' ? 'Fila de atendimento' : 'Histórico encerrado'}</h2>
            <p className="list-order-hint">
              {emAgenda
                ? 'Atendimentos ordenados por horário e, no empate, por prioridade.'
                : filaFiltradaPorAgendada
                  ? 'Já têm horário marcado: ordenadas por horário e, no empate, por prioridade.'
                  : escopo === 'aberto'
                    ? 'Registros ordenados pela prioridade e pelo tempo de espera.'
                    : 'Solicitações concluídas e canceladas, do encerramento mais recente ao mais antigo.'}
            </p>
          </div>
          {data && !loading && !error && <span className="record-count">{data.total} no total</span>}
        </div>

        <div className="view-switcher" aria-label="Visão da fila">
          <div className="view-switcher__group" role="group" aria-label="Escopo da listagem">
            <button type="button" className={`button button--outline ${visao === 'fila' ? 'is-active' : ''}`} aria-pressed={visao === 'fila'} onClick={() => mudarVisao('fila')}>Fila atual</button>
            <button type="button" className={`button button--outline ${emAgenda ? 'is-active' : ''}`} aria-pressed={emAgenda} onClick={() => mudarVisao('agenda')}>Agenda</button>
            <button type="button" className={`button button--outline ${visao === 'historico' ? 'is-active' : ''}`} aria-pressed={visao === 'historico'} onClick={() => mudarVisao('historico')}>Histórico encerrado</button>
            <button type="button" className="button button--outline" aria-pressed={false} onClick={() => mudarVisao('faltas')}>Faltas</button>
          </div>
          {visao === 'fila' && (
            <div className="view-switcher__group" role="group" aria-label="Organização da fila">
              <button type="button" className={`button button--ghost ${modo === 'prioridade' ? 'is-active' : ''}`} aria-pressed={modo === 'prioridade'} onClick={() => setModo('prioridade')}>Por prioridade</button>
              <button type="button" className={`button button--ghost ${modo === 'categoria' ? 'is-active' : ''}`} aria-pressed={modo === 'categoria'} onClick={() => setModo('categoria')}>Explorar por categoria</button>
            </div>
          )}
        </div>

        {visao === 'fila' && modo === 'categoria' && (
          <div className="category-explorer" aria-label="Categorias de atendimento">
            <p><strong>{resumo?.prioridade_aberta.URGENTE ?? 0}</strong> urgentes na fila total. Escolher uma categoria não altera a ordem de prioridade.</p>
            <div className="category-explorer__actions">
              <button type="button" className={`button button--outline ${!categoria ? 'is-active' : ''}`} onClick={() => { setCategoria(''); setPage(1); }}>Todas</button>
              {CATEGORIA_LIST.map(item => <button type="button" key={item} className={`button button--outline ${categoria === item ? 'is-active' : ''}`} onClick={() => { setCategoria(item); setPage(1); }}>{LABEL_CATEGORIA[item]}</button>)}
            </div>
          </div>
        )}

        {emAgenda && (
          <div className="agenda-toolbar">
            <div className="filter-field agenda-date-field">
              <label htmlFor="filtro-data-agenda">Data da agenda</label>
              <input id="filtro-data-agenda" type="date" value={dataAgenda} onChange={event => trocarDia(event.target.value)} />
            </div>
          </div>
        )}

        <div className="filter-bar" aria-label="Filtros da listagem">
          {!emAgenda && (
            <div className="filter-field">
              <label htmlFor="filtro-status">Status</label>
              <select id="filtro-status" value={status} onChange={event => alterarStatus(event.target.value as Status | '')}>
                <option value="">Todos</option>
                {statusDisponiveis.map(item => <option key={item} value={item}>{LABEL_STATUS[item]}</option>)}
              </select>
            </div>
          )}
          {filaFiltradaPorAgendada && (
            <div className="filter-field agenda-date-field">
              <label htmlFor="filtro-data-fila">Data agendada (opcional)</label>
              <input
                id="filtro-data-fila"
                type="date"
                value={dataFilaAgendada}
                onChange={event => { setDataFilaAgendada(event.target.value); setPage(1); }}
              />
            </div>
          )}
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
            <strong>{hasFilters ? 'Nenhum resultado para estes filtros' : emAgenda ? 'Nenhum atendimento agendado para este dia' : 'Nenhuma solicitação cadastrada'}</strong>
            <p>{hasFilters ? 'Revise ou limpe os filtros para ampliar a busca.' : emAgenda ? 'Escolha outra data ou agende uma solicitação em análise.' : 'Crie a primeira solicitação para iniciar o acompanhamento.'}</p>
            {hasFilters ? (
              <button className="button button--outline" type="button" onClick={clearFilters}>Limpar filtros</button>
            ) : emAgenda ? null : (
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
                    <th scope="col">{emAgenda ? 'Agendado para' : 'Data'}</th>
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

      {!emAgenda && !resumoLoading && !resumoError && resumo && (
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
          {status && ` O bloco "${LABEL_STATUS_PLURAL[status]}" abaixo está destacado — é o que corresponde ao filtro de status escolhido.`}
        </p>
      )}

      {!emAgenda && !resumoLoading && !resumoError && resumo && (
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
                  {resumo.mais_antiga_aberta[item] && (
                    <span className="priority-card__aging">mais antiga: {formatAging(resumo.mais_antiga_aberta[item]!)}</span>
                  )}
                  <span className="priority-card__action">Em aberto ›</span>
                </button>
              );
            })}
          </div>

          <div className="workflow-strip" aria-label="Andamento por etapa, nas mesmas solicitações">
            <span className="workflow-strip__label">Por etapa:</span>
            {STATUS_LIST.map((item, index) => {
              const encerrada = (STATUS_ENCERRADO as readonly Status[]).includes(item);
              const primeiraEncerrada = encerrada && index > 0 && !(STATUS_ENCERRADO as readonly Status[]).includes(STATUS_LIST[index - 1]);
              return (
                <button
                  type="button"
                  key={item}
                  className={[
                    'workflow-strip__pill',
                    encerrada ? 'workflow-strip__pill--encerrada' : '',
                    primeiraEncerrada ? 'workflow-strip__pill--divider' : '',
                    status === item ? 'workflow-strip__pill--active' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => abrirPorStatus(item)}
                  aria-pressed={status === item}
                  aria-label={`${resumo.status[item]} ${resumo.status[item] === 1 ? STATUS_ARIA[item][0] : STATUS_ARIA[item][1]}. Ver lista.`}
                >
                  {LABEL_STATUS_PLURAL[item]} <strong>{resumo.status[item]}</strong>
                </button>
              );
            })}
          </div>
        </section>
      )}

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
