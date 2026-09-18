import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSolicitacoes } from '../hooks/useSolicitacoes';
import { StatusBadge, PrioridadeBadge } from '../../../components/Badge';
import { LABEL_CATEGORIA } from '../types';
import type { FiltrosSolicitacoes } from '../types';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}

interface DrilldownModalProps {
  title: string;
  description: string;
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const { data, loading, error } = useSolicitacoes({ ...filtros, per_page: 50 });

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    closeButtonRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
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
        className={`drilldown-modal drilldown-modal--${accent}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drilldown-title"
        onClick={event => event.stopPropagation()}
      >
        <header className="drilldown-modal__header">
          <div>
            <p className="eyebrow">{description}</p>
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
                  <Link to={`/solicitacoes/${item.id}`} className="drilldown-list__item" onClick={onClose}>
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

        {!loading && !error && (data?.total ?? 0) > (data?.data?.length ?? 0) && (
          <footer className="drilldown-modal__footer">
            <p>Mostrando {data?.data?.length ?? 0} de {data?.total ?? 0}. Use os filtros da listagem para ver o restante.</p>
          </footer>
        )}
      </div>
    </div>
  );
}
