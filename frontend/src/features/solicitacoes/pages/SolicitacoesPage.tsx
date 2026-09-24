import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSolicitacoes, useResumoSolicitacoes, useProximaSolicitacao } from '../hooks/useSolicitacoes';
import { StatusBadge, PrioridadeBadge } from '../../../components/Badge';
import { DrilldownModal } from '../components/DrilldownModal';
import { ViewSwitcher } from '../components/ViewSwitcher';
import { SolicitacoesTable } from '../components/SolicitacoesTable';
import { FaltasView } from '../components/FaltasView';
import { dataHojeNoFuso, dataIsoValida, formatarAgendamento, formatarDataLocal } from '../config/agendamento';
import type { Status, Categoria, Prioridade, Solicitacao } from '../types';
import type { FiltrosSolicitacoes } from '../types';
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

/** As duas etapas finais — usadas só para excluí-las do filtro de status desta página (o
 * histórico encerrado tem página própria, ver HistoricoSolicitacoesPage) e para desenhar a
 * divisória na tira de etapas abaixo. */
const STATUS_ENCERRADO = ['CONCLUIDA', 'CANCELADA'] as const satisfies readonly Status[];
type VisaoPrincipal = 'fila' | 'agenda' | 'faltas';
type ModoFila = 'prioridade' | 'categoria';

function visaoPelosParametros(searchParams: URLSearchParams): VisaoPrincipal {
  const parametro = searchParams.get('visao');
  if (parametro === 'agenda') return 'agenda';
  if (parametro === 'faltas') return 'faltas';
  return 'fila';
}

const PRIORIDADE_ACCENT: Record<Prioridade, 'urgente' | 'alta' | 'media' | 'baixa'> = {
  URGENTE: 'urgente',
  ALTA: 'alta',
  MEDIA: 'media',
  BAIXA: 'baixa',
};

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
  description?: string;
  accent: 'urgente' | 'alta' | 'media' | 'baixa' | 'neutro';
  filtros: FiltrosSolicitacoes;
}

/**
 * Frase de status temporal da "próxima solicitação por prioridade". "Esperando há N dias"
 * só faz sentido enquanto a solicitação ainda não tem agendamento (o tempo é medido desde a
 * criação, na fila); depois de AGENDADA, mostrar essa mesma frase é enganoso — dá a entender
 * que ainda está em espera/atrasada mesmo quando o agendamento é para uma data futura.
 */
function statusTemporal(item: Solicitacao): { texto: string; atrasado: boolean } {
  const ativo = item.agendamento_ativo;

  if (ativo?.modalidade === 'HORARIO' && item.agendado_para) {
    return {
      texto: `agendado para ${formatarAgendamento(item.agendado_para)}`,
      atrasado: new Date(item.agendado_para).getTime() < Date.now(),
    };
  }

  if (ativo?.modalidade === 'TURNO' && ativo.turno) {
    return {
      texto: `agendado para ${formatarDataLocal(ativo.data_agendada)} · turno da ${LABEL_TURNO[ativo.turno].toLowerCase()}`,
      atrasado: ativo.data_agendada < dataHojeNoFuso(),
    };
  }

  return { texto: `esperando ${formatAging(item.data_criacao)}`, atrasado: false };
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
  const filaFiltradaPorAgendada = !emAgenda && status === 'AGENDADA';

  // Data ausente ou inválida na URL da agenda é normalizada para o dia efetivamente consultado.
  useEffect(() => {
    if (visao === 'agenda' && searchParams.get('data') !== dataAgenda) {
      setSearchParams({ visao: 'agenda', data: dataAgenda }, { replace: true });
    }
  }, [dataAgenda, searchParams, setSearchParams, visao]);

  // Trocar de visão (fila/agenda/faltas) descarta os filtros da visão anterior — evita levar,
  // por exemplo, um filtro de status ou uma página 3 de uma lista para outra bem menor.
  useEffect(() => {
    setStatus('');
    setDataFilaAgendada('');
    setPage(1);
  }, [visao]);

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
          status_grupo: 'aberto',
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
  const statusDisponiveis = STATUS_LIST.filter(item => !(STATUS_ENCERRADO as readonly Status[]).includes(item));

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

  const trocarDia = (novaData: string) => {
    if (!dataIsoValida(novaData)) return;
    setPage(1);
    setSearchParams({ visao: 'agenda', data: novaData });
  };

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

  if (emFaltas) return <FaltasView />;

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
                {(() => {
                  const { texto, atrasado } = statusTemporal(proximo);
                  return (
                    <p className={`next-up__meta${atrasado ? ' next-up__meta--atrasado' : ''}`}>
                      {LABEL_CATEGORIA[proximo.categoria]} · {texto}
                      {atrasado && ' · em atraso'}
                    </p>
                  );
                })()}
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
            <h2 id="list-heading">{emAgenda ? 'Agenda do dia' : 'Fila de atendimento'}</h2>
            <p className="list-order-hint">
              {emAgenda
                ? 'Atendimentos ordenados por horário e, no empate, por prioridade.'
                : filaFiltradaPorAgendada
                  ? 'Já têm horário marcado: ordenadas por horário e, no empate, por prioridade.'
                  : 'Registros ordenados pela prioridade e pelo tempo de espera.'}
            </p>
          </div>
          {data && !loading && !error && <span className="record-count">{data.total} no total</span>}
        </div>

        <div className="view-switcher" aria-label="Visão da fila">
          <ViewSwitcher ativo={visao} />
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

        <SolicitacoesTable
          data={data}
          loading={loading}
          error={error}
          onReload={reload}
          page={page}
          onPageChange={setPage}
          colunaQuinta={emAgenda ? 'Agendado para' : 'Data'}
          empty={{
            titulo: hasFilters ? 'Nenhum resultado para estes filtros' : emAgenda ? 'Nenhum atendimento agendado para este dia' : 'Nenhuma solicitação cadastrada',
            descricao: hasFilters ? 'Revise ou limpe os filtros para ampliar a busca.' : emAgenda ? 'Escolha outra data ou agende uma solicitação em análise.' : 'Crie a primeira solicitação para iniciar o acompanhamento.',
            acao: hasFilters ? (
              <button className="button button--outline" type="button" onClick={clearFilters}>Limpar filtros</button>
            ) : emAgenda ? undefined : (
              <Link to="/solicitacoes/nova" className="button button--outline">Criar solicitação</Link>
            ),
          }}
        />
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
