import type { Status, Prioridade } from '../features/solicitacoes/types';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  RECEBIDA:   { bg: '#dbeafe', color: '#1d4ed8' },
  EM_ANALISE: { bg: '#fef9c3', color: '#854d0e' },
  AGENDADA:   { bg: '#dcfce7', color: '#166534' },
  CONCLUIDA:  { bg: '#f0fdf4', color: '#166534' },
  CANCELADA:  { bg: '#fee2e2', color: '#991b1b' },
};

const PRIO_COLORS: Record<string, { bg: string; color: string }> = {
  BAIXA:   { bg: '#f1f5f9', color: '#475569' },
  MEDIA:   { bg: '#dbeafe', color: '#1d4ed8' },
  ALTA:    { bg: '#fff7ed', color: '#9a3412' },
  URGENTE: { bg: '#fee2e2', color: '#991b1b' },
};

export function StatusBadge({ status }: { status: Status }) {
  const c = STATUS_COLORS[status] ?? { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      background: c.bg, color: c.color, padding: '2px 10px',
      borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.02em'
    }}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  const c = PRIO_COLORS[prioridade] ?? { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      background: c.bg, color: c.color, padding: '2px 10px',
      borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600
    }}>
      {prioridade}
    </span>
  );
}
