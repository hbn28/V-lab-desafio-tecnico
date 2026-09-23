import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useSolicitacoes, useResumoSolicitacoes, useFaltas } from '../hooks/useSolicitacoes';
import { solicitacoesApi } from '../api/client';
import { StatusBadge, PrioridadeBadge } from '../../../components/Badge';
import { DrilldownModal } from '../components/DrilldownModal';
import { FaltaCard } from '../components/FaltaCard';
import { ContatoFaltaDialog } from '../components/ContatoFaltaDialog';
import { DialogOverlay } from '../components/DialogOverlay';
import { AgendamentoForm } from '../components/AgendamentoForm';
import { dataHojeNoFuso, dataIsoValida, formatarAgendamento } from '../config/agendamento';
import { SolicitacoesToolbar } from '../components/SolicitacoesToolbar';
import { useSolicitacoesQuery } from '../hooks/useSolicitacoesQuery';
import { deslocarDataIso, useAgendaSemanal } from '../hooks/useAgendaSemanal';
import type { Status, Categoria, Prioridade } from '../types';
import type { AgendamentoPayload, FaltaListItem, FiltrosSolicitacoes, ResultadoContato } from '../types';
import { LABEL_CATEGORIA, LABEL_PRIORIDADE, LABEL_TURNO } from '../types';

const STATUS_LIST: Status[] = ['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA'];
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

function formatDiaAgenda(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    .format(new Date(`${value}T12:00:00Z`));
}

interface Drilldown {
  title: string;
  description?: string;
  accent: 'urgente' | 'alta' | 'media' | 'baixa' | 'neutro';
  filtros: FiltrosSolicitacoes;
}

export function SolicitacoesPage() {
  const location = useLocation();
  const returnContext = { state: { from: `${location.pathname}${location.search}` } };
  const [searchParams, setSearchParams] = useSearchParams();
  const { consulta, aplicar, limpar: limparConsulta, setPagina: setPaginaUrl } = useSolicitacoesQuery();
  const status: Status | '' = consulta.status ?? '';
  const categoria: Categoria | '' = consulta.categoria ?? '';
  const prioridade: Prioridade | '' = consulta.prioridade ?? '';
  const visao = visaoPelosParametros(searchParams);
  // O fallback é calculado uma única vez: passar da meia-noite com a tela aberta não troca o dia consultado.
  const [dataAgendaPadrao] = useState(dataHojeNoFuso);
  const dataDaUrl = consulta.inicio ?? searchParams.get('inicio') ?? searchParams.get('data');
  const dataAgenda = dataIsoValida(dataDaUrl) ? dataDaUrl : dataAgendaPadrao;
  const page = consulta.page ?? 1;
  const setPage = (proxima: number | ((atual: number) => number)) => {
    const valor = typeof proxima === 'function' ? proxima(page) : proxima;
    setPaginaUrl(valor);
  };
  const [drilldown, setDrilldown] = useState<Drilldown | null>(null);
  // Filtro de dia dentro da própria fila (ADR 003): só faz sentido com status=AGENDADA,
  // que é quando a ordenação passa a ser por horário em vez de prioridade.
  const dataFilaAgendada = consulta.data_agendada ?? '';
  const setDataFilaAgendada = (data: string) => aplicar({ data_agendada: data || undefined, ...(data && consulta.ordenar_por === 'data' ? { ordenar_por: 'horario' as const } : {}) });
  const aplicarFiltros = (patch: Partial<typeof consulta>) => aplicar({
    ...patch,
    ...(patch.status !== undefined && patch.ordenar_por === undefined ? { ordenar_por: patch.status === 'AGENDADA' ? 'horario' as const : patch.status === 'CONCLUIDA' || patch.status === 'CANCELADA' ? 'data' as const : 'prioridade' as const } : {}),
    ...(patch.status === 'CONCLUIDA' || patch.status === 'CANCELADA' ? { direcao: patch.direcao ?? 'desc' as const } : {}),
    ...(patch.status && patch.status !== 'AGENDADA' ? { data_agendada: undefined } : {}),
  });

  const emAgenda = visao === 'agenda';
  const emFaltas = visao === 'faltas';
  const escopo = visao === 'historico' ? 'encerrado' : 'aberto';
  const filaFiltradaPorAgendada = !emAgenda && status === 'AGENDADA';

  const filtrosFaltas = {
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
  const { data: faltas, loading: faltasLoading, error: faltasError, reload: reloadFaltas } = useFaltas({ enabled: emFaltas, filtros: filtrosFaltas });
  const { datas: diasDaAgenda, grupos: gruposAgenda, reload: reloadAgenda } = useAgendaSemanal({
    inicio: dataAgenda,
    filtros: {
      q: consulta.q,
      categoria: consulta.categoria,
      prioridade: consulta.prioridade,
      ordenar_por: consulta.ordenar_por ?? 'horario',
      direcao: consulta.direcao,
      data_de: consulta.data_de,
      data_ate: consulta.data_ate,
      per_page: 10,
    },
    paginas: consulta.agendaPages ?? {},
    enabled: emAgenda,
  });
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
      await reloadFaltas();
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
      await reloadFaltas();
    } catch (caught: unknown) {
      const erros = caught instanceof Error && 'errors' in caught
        ? ((caught as Error & { errors?: Record<string, string[]> }).errors ?? {})
        : {};
      if (Object.keys(erros).length > 0) {
        setErrosReagendamento(erros);
      } else {
        setErroReagendamento(caught instanceof Error ? caught.message : 'Não foi possível reagendar após a falta. Tente novamente.');
        if (caught instanceof Error && 'status' in caught && (caught as Error & { status?: number }).status === 409) {
          await reloadFaltas();
        }
      }
    } finally {
      setSalvandoReagendamento(false);
    }
  };

  // Links antigos com data exata passam a usar essa data como início da janela semanal.
  useEffect(() => {
    if (visao === 'agenda' && (!consulta.inicio || searchParams.has('data'))) {
      const preservados = new URLSearchParams(searchParams);
      preservados.set('visao', 'agenda');
      preservados.set('inicio', dataAgenda);
      preservados.delete('data');
      setSearchParams(preservados, { replace: true });
    }
  }, [consulta.inicio, dataAgenda, searchParams, setSearchParams, visao]);

  const { data, loading, error, reload } = useSolicitacoes(
    emAgenda
      ? {
          status: 'AGENDADA',
          data_agendada: dataAgenda,
          q: consulta.q,
          ordenar_por: consulta.ordenar_por,
          direcao: consulta.direcao,
          data_de: consulta.data_de,
          data_ate: consulta.data_ate,
          categoria: categoria || undefined,
          prioridade: prioridade || undefined,
          page,
          per_page: 10,
        }
      : {
          status: status || undefined,
          q: consulta.q,
          ordenar_por: consulta.ordenar_por,
          direcao: consulta.direcao,
          data_de: consulta.data_de,
          data_ate: consulta.data_ate,
          categoria: categoria || undefined,
          prioridade: prioridade || undefined,
          status_grupo: escopo,
          data_agendada: filaFiltradaPorAgendada && dataIsoValida(dataFilaAgendada) ? dataFilaAgendada : undefined,
          page,
          per_page: 10,
        }
  , !emAgenda);

  const resumoFiltros = { categoria: categoria || undefined, prioridade: prioridade || undefined };
  const isDrilldownAberto = Boolean(drilldown);
  // A agenda não exibe o painel global nem a próxima solicitação: pausa a revalidação em segundo plano.
  const { data: resumo, loading: resumoLoading, error: resumoError } = useResumoSolicitacoes(resumoFiltros, { paused: isDrilldownAberto || emAgenda });
  // "Próxima solicitação por prioridade" é um fato operacional fixo (a #1 na ordem da fila, ADR 001) —
  // não muda com os filtros da listagem, que são só uma forma de explorar o resto da fila.
  const hasFilters = Boolean(status || categoria || prioridade || dataFilaAgendada || consulta.q || consulta.data_de || consulta.data_ate);
  const statusDisponiveis: Status[] = escopo === 'aberto'
    ? STATUS_LIST.filter(item => !(STATUS_ENCERRADO as readonly Status[]).includes(item))
    : [...STATUS_ENCERRADO];

  const clearFilters = () => {
    limparConsulta();
  };

  const mudarVisao = (novaVisao: VisaoPrincipal) => {
    aplicar({
      visao: novaVisao,
      status: undefined,
      status_grupo: novaVisao === 'historico' ? 'encerrado' : 'aberto',
      data_agendada: undefined,
      data: undefined,
      inicio: novaVisao === 'agenda' ? dataAgenda : undefined,
      agendaPages: novaVisao === 'agenda' ? consulta.agendaPages : {},
      ordenar_por: novaVisao === 'agenda' ? 'horario' : undefined,
    });
  };

  const mudarSemana = (dias: number) => aplicar({ visao: 'agenda', inicio: deslocarDataIso(dataAgenda, dias), data: undefined, agendaPages: {} });
  const mudarPaginaDia = (dia: string, pagina: number) => aplicar({ agendaPages: { ...(consulta.agendaPages ?? {}), [dia]: pagina } });

  const abrirPorPrioridade = (item: Prioridade) => {
    const count = resumo?.prioridade_aberta[item] ?? 0;
    setDrilldown({
      // Uma frase só (sem eyebrow duplicada): antes tínhamos "N solicitações urgentes em
      // aberto" pequeno em cima de "Urgente em aberto" grande, repetindo a mesma informação.
      title: `${count} ${count === 1 ? PRIORIDADE_ARIA[item][0] : PRIORIDADE_ARIA[item][1]}`,
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
          </div>
        </header>

        <div className="view-switcher" aria-label="Visão da fila">
          <div className="view-switcher__group" role="group" aria-label="Escopo da listagem">
            <button type="button" className="button button--outline" onClick={() => mudarVisao('fila')}>Fila</button>
            <button type="button" className="button button--outline" onClick={() => mudarVisao('agenda')}>Solicitações agendadas</button>
            <button type="button" className="button button--outline" onClick={() => mudarVisao('historico')}>Histórico</button>
            <button type="button" className="button button--outline is-active" aria-pressed="true" onClick={() => mudarVisao('faltas')}>Faltas</button>
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
          onApply={aplicarFiltros}
          onClear={limparConsulta}
        />


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
          <>
            <div className="faltas-list">
              {faltas.data.map(falta => (
                <FaltaCard key={falta.id} falta={falta} onRegistrarContato={abrirContato} onReagendar={abrirReagendamento} />
              ))}
            </div>
            <nav className="pagination" aria-label="Paginação das faltas">
              <p>Página <strong>{faltas.current_page}</strong> de <strong>{faltas.last_page}</strong></p>
              <div className="pagination__actions">
                <button className="button button--outline" disabled={faltas.current_page === 1} onClick={() => setPage(faltas.current_page - 1)} type="button">Anterior</button>
                <button className="button button--outline" disabled={faltas.current_page === faltas.last_page} onClick={() => setPage(faltas.current_page + 1)} type="button">Próxima</button>
              </div>
            </nav>
          </>
        )}

        {faltaContato && (
          <ContatoFaltaDialog submitting={enviandoContato} error={erroContato} onSalvar={salvarContato} onCancelar={fecharContato} />
        )}

        {faltaReagendando && (
          <DialogOverlay labelledBy="reagendar-falta-heading" onClose={fecharReagendamento}>
            <h2 id="reagendar-falta-heading">Reagendar após falta</h2>
            {erroReagendamento && <div className="alert alert--error" role="alert">{erroReagendamento}</div>}
            <AgendamentoForm
              submitting={salvandoReagendamento}
              serverErrors={errosReagendamento}
              submitLabel="Confirmar novo agendamento"
              onSubmit={salvarReagendamento}
              onCancel={fecharReagendamento}
            />
          </DialogOverlay>
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
        </div>
        <Link to="/solicitacoes/nova" className="button button--primary">
          <span aria-hidden="true">＋</span>
          Nova solicitação
        </Link>
      </header>

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

        {emAgenda && <div className="agenda-week" aria-label="Filas de solicitações por dia">
          {diasDaAgenda.map(dia => {
            const grupo = gruposAgenda[dia];
            const paginaDia = consulta.agendaPages?.[dia] ?? 1;
            return (
              <section className="agenda-day" key={dia} aria-labelledby={`agenda-dia-${dia}`}>
                <header className="agenda-day__header">
                  <h3 id={`agenda-dia-${dia}`}>{formatDiaAgenda(dia)}</h3>
                  {!grupo?.loading && !grupo?.error && <span className="record-count">{grupo?.total ?? 0} solicitações</span>}
                </header>
                {grupo?.loading && <p className="state-view state-view--compact" role="status">Carregando este dia</p>}
                {grupo?.error && <div className="alert alert--error" role="alert"><p>{grupo.error}</p><button type="button" className="button button--outline" onClick={reloadAgenda}>Tentar novamente</button></div>}
                {!grupo?.loading && !grupo?.error && grupo?.data.length === 0 && <p className="agenda-day__empty">Nenhuma solicitação agendada.</p>}
                {!grupo?.loading && !grupo?.error && grupo && grupo.data.length > 0 && <>
                  <ul className="agenda-day__list">
                    {grupo.data.map(item => (
                      <li key={item.id}>
                        <Link to={`/solicitacoes/${item.id}`} {...returnContext} className="agenda-day__item">
                          <span className="agenda-day__time">{item.agendado_para ? formatarAgendamento(item.agendado_para) : item.agendamento_ativo?.turno ? LABEL_TURNO[item.agendamento_ativo.turno] : 'Horário não informado'}</span>
                          <span className="agenda-day__request"><strong>{item.protocolo}</strong><span>{item.nome_solicitante}</span></span>
                          <PrioridadeBadge prioridade={item.prioridade} />
                          <StatusBadge status={item.status} />
                          <span>{LABEL_CATEGORIA[item.categoria]}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {grupo.last_page > 1 && <nav className="pagination" aria-label={`Paginação de ${formatDiaAgenda(dia)}`}>
                    <p>Página <strong>{paginaDia}</strong> de <strong>{grupo.last_page}</strong></p>
                    <div className="pagination__actions">
                      <button className="button button--outline" disabled={paginaDia <= 1} onClick={() => mudarPaginaDia(dia, paginaDia - 1)} type="button">Anterior</button>
                      <button className="button button--outline" disabled={paginaDia >= grupo.last_page} onClick={() => mudarPaginaDia(dia, paginaDia + 1)} type="button">Próxima</button>
                    </div>
                  </nav>}
                </>}
              </section>
            );
          })}
        </div>}
      </section>

      {!emAgenda && !resumoLoading && !resumoError && resumo && (
        <section className="dashboard-section" aria-labelledby="priority-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Atenção imediata</p>
              <h2 id="priority-heading">Prioridades em aberto</h2>
            </div>
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
