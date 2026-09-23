import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSolicitacoes } from '../hooks/useSolicitacoes';
import { StatusBadge, PrioridadeBadge } from '../../../components/Badge';
import { LABEL_CATEGORIA } from '../types';
import type { FiltrosSolicitacoes } from '../types';
import type { SolicitacoesConsulta } from '../types';
import { SolicitacoesToolbar } from './SolicitacoesToolbar';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}

interface DrilldownModalProps {
  title: string;
  /** Opcional: quando omitida, o cabeçalho mostra só o título — evita repetir a mesma
   * informação em duas frases (uma pequena, uma grande) quando o título já é autoexplicativo. */
  description?: string;
  accent: 'urgente' | 'alta' | 'media' | 'baixa' | 'neutro';
  filtros: FiltrosSolicitacoes;
  onClose: () => void;
}

/**
 * Janela de drill-down: abre a partir de um cartão do painel (ex.: "Urgente em aberto")
 * e mostra, ao vivo, as solicitações daquele bloco específico — sem sair do painel.
 *
 * Modal acessível construída sem o elemento <dialog> (suporte inconsistente entre
 * navegadores/ambientes de teste): foco move para o botão de fechar ao abrir, Esc e
 * clique no fundo fecham, e o foco volta para quem abriu a janela.
 */
export function DrilldownModal({ title, description, accent, filtros, onClose }: DrilldownModalProps) {
  const location = useLocation();
  const contextoFixo = Object.fromEntries(Object.entries(filtros).filter(([, value]) => value !== undefined)) as FiltrosSolicitacoes;
  const defaultSort = filtros.status === 'AGENDADA'
    ? 'horario'
    : filtros.prioridade ? 'data'
      : filtros.status === 'CONCLUIDA' || filtros.status === 'CANCELADA' ? 'data' : 'prioridade';
  const defaultDirection = filtros.status === 'CONCLUIDA' || filtros.status === 'CANCELADA' ? 'desc' : 'asc';
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const [consulta, setConsulta] = useState<SolicitacoesConsulta>({ ...contextoFixo, ordenar_por: defaultSort, direcao: defaultDirection });
  const page = consulta.page ?? 1;
  const { data, loading, error } = useSolicitacoes({ ...consulta, ...contextoFixo, page, per_page: 10 });
  const contextoEncerrado = filtros.status === 'CONCLUIDA' || filtros.status === 'CANCELADA' || filtros.status_grupo === 'encerrado';
  const returnParams = new URLSearchParams(location.search);
  ['q', 'status', 'status_grupo', 'categoria', 'prioridade', 'data_agendada', 'data_de', 'data_ate', 'resultado_contato', 'visao', 'page', 'per_page', 'ordenar_por', 'direcao'].forEach(key => returnParams.delete(key));
  returnParams.set('visao', contextoEncerrado ? 'historico' : 'fila');
  returnParams.set('status_grupo', contextoEncerrado ? 'encerrado' : 'aberto');
  Object.entries({ ...consulta, ...contextoFixo, page }).forEach(([key, value]) => {
    if (key === 'agendaPages' || key === 'visao' || value === undefined || value === '') return;
    returnParams.set(key, String(value));
  });
  if (contextoFixo.status) returnParams.set('status', contextoFixo.status);
  if (consulta.ordenar_por) returnParams.set('ordenar_por', consulta.ordenar_por);
  if (consulta.direcao) returnParams.set('direcao', consulta.direcao);
  const returnTo = `${location.pathname}${returnParams.size ? `?${returnParams.toString()}` : ''}`;

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    closeButtonRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previouslyFocused.current instanceof HTMLElement) previouslyFocused.current.focus();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="drilldown-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`drilldown-modal drilldown-modal--${accent}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drilldown-title"
        onClick={event => event.stopPropagation()}
      >
        <header className="drilldown-modal__header">
          <div>
            {description && <p className="eyebrow">{description}</p>}
            <h2 id="drilldown-title">{title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="drilldown-modal__close"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="drilldown-modal__body">
          <SolicitacoesToolbar
            consulta={consulta}
          opcoesOrdenacao={filtros.status === 'AGENDADA'
            ? filtros.data_agendada
              ? filtros.prioridade ? ['horario'] : ['horario', 'prioridade']
              : filtros.prioridade ? ['horario', 'data'] : ['horario', 'prioridade', 'data']
            : filtros.prioridade ? ['data'] : ['prioridade', 'data']}
          ordenacaoPadrao={defaultSort}
          direcaoPadrao={defaultDirection}
            total={data?.total ?? 0}
            mostrarStatus={!filtros.status && !filtros.status_grupo}
            mostrarCategoria={!filtros.categoria}
            mostrarPrioridade={!filtros.prioridade}
            filtrosFixos={Object.keys(contextoFixo) as Array<keyof SolicitacoesConsulta>}
            mostrarPeriodo
            onApply={patch => setConsulta(current => ({ ...current, ...patch, page: 1 }))}
            onClear={() => setConsulta({ ...contextoFixo, ordenar_por: defaultSort, direcao: defaultDirection, page: 1 })}
          />
          {loading && (
            <div className="state-view state-view--compact" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <p>Carregando solicitações…</p>
            </div>
          )}

          {error && (
            <div className="alert alert--error" role="alert">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (data?.data?.length ?? 0) === 0 && (
            <div className="state-view state-view--compact">
              <span className="state-view__icon" aria-hidden="true">○</span>
              <p>Nenhuma solicitação neste bloco no momento.</p>
            </div>
          )}

          {!loading && !error && (data?.data?.length ?? 0) > 0 && (
            <ul className="drilldown-list">
              {data!.data.map(item => (
                <li key={item.id}>
                  <Link to={`/solicitacoes/${item.id}`} state={{ from: returnTo }} className="drilldown-list__item" onClick={onClose}>
                    <div className="drilldown-list__main">
                      <span className="protocol-link">{item.protocolo}</span>
                      <span className="requester-name">{item.nome_solicitante}</span>
                    </div>
                    <div className="drilldown-list__meta">
                      <PrioridadeBadge prioridade={item.prioridade} />
                      <StatusBadge status={item.status} />
                      <span className="drilldown-list__category">{LABEL_CATEGORIA[item.categoria]}</span>
                      <time dateTime={item.data_criacao}>{formatDate(item.data_criacao)}</time>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!loading && !error && data && data.last_page > 1 && (
          <footer className="drilldown-modal__footer">
            <p>Página {page} de {data.last_page}</p>
            <div className="pagination__actions">
              <button className="button button--outline" type="button" disabled={page <= 1} onClick={() => setConsulta(current => ({ ...current, page: page - 1 }))}>Anterior</button>
              <button className="button button--outline" type="button" disabled={page >= data.last_page} onClick={() => setConsulta(current => ({ ...current, page: page + 1 }))}>Próxima</button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
