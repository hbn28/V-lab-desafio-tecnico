import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useSolicitacoes, useResumoSolicitacoes } from '../hooks/useSolicitacoes';
import { DrilldownModal } from '../components/DrilldownModal';
import { FaltasView } from '../components/FaltasView';
import { FilaView } from '../components/FilaView';
import { dataHojeNoFuso, dataIsoValida } from '../config/agendamento';
import { useSolicitacoesQuery } from '../hooks/useSolicitacoesQuery';
import { deslocarDataIso, useAgendaSemanal } from '../hooks/useAgendaSemanal';
import type { Status, Categoria, Prioridade } from '../types';
import type { FiltrosSolicitacoes } from '../types';
import { LABEL_PRIORIDADE } from '../types';

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
import type { VisaoPrincipal } from '../components/FilaView';

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
    return <FaltasView consulta={consulta} page={page} onPageChange={setPaginaUrl} onApply={aplicarFiltros} onClear={limparConsulta} onChangeView={mudarVisao} />;
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

      <FilaView
        emAgenda={emAgenda}
        visao={visao}
        escopo={escopo}
        data={data}
        loading={loading}
        error={error}
        reload={reload}
        consulta={consulta}
        page={page}
        setPage={setPage}
        statusDisponiveis={statusDisponiveis}
        filaFiltradaPorAgendada={filaFiltradaPorAgendada}
        dataFilaAgendada={dataFilaAgendada}
        onDataFilaAgendada={setDataFilaAgendada}
        hasFilters={hasFilters}
        dataAgenda={dataAgenda}
        diasDaAgenda={diasDaAgenda}
        gruposAgenda={gruposAgenda}
        returnContext={returnContext}
        onChangeView={mudarVisao}
        onChangeWeek={mudarSemana}
        onApply={aplicarFiltros}
        onClear={clearFilters}
        onReloadAgenda={reloadAgenda}
        onChangeAgendaPage={mudarPaginaDia}
      />

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
