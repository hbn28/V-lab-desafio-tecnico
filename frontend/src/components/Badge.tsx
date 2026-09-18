import type { Status, Prioridade } from '../features/solicitacoes/types';
import { LABEL_PRIORIDADE, LABEL_STATUS } from '../features/solicitacoes/types';

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge badge--status-${status.toLowerCase()}`}>
      <span className="badge__dot" aria-hidden="true" />
      {LABEL_STATUS[status]}
    </span>
  );
}

export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  return (
    <span className={`badge badge--priority-${prioridade.toLowerCase()}`}>
      {LABEL_PRIORIDADE[prioridade]}
    </span>
  );
}
