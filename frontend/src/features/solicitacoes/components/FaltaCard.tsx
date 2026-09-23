import type { FaltaListItem } from '../types';
import { LABEL_TURNO } from '../types';
import { formatarAgendamento } from '../config/agendamento';
import { PrioridadeBadge } from '../../../components/Badge';

interface FaltaCardProps {
  falta: FaltaListItem;
  onRegistrarContato: (falta: FaltaListItem) => void;
  onReagendar: (falta: FaltaListItem) => void;
}

function quandoEraOAgendamento(falta: FaltaListItem): string {
  if (falta.modalidade === 'HORARIO' && falta.hora_agendada) {
    const data = formatarAgendamento(`${falta.data_agendada}T12:00:00Z`).split(' ')[0];
    return `${data} ${falta.hora_agendada.slice(0, 5)}`;
  }
  if (falta.modalidade === 'TURNO' && falta.turno) {
    const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' })
      .format(new Date(`${falta.data_agendada}T12:00:00Z`));
    return `${data} · ${LABEL_TURNO[falta.turno]}`;
  }
  return falta.data_agendada;
}

export function FaltaCard({ falta, onRegistrarContato, onReagendar }: FaltaCardProps) {
  const paciente = falta.solicitacao?.paciente;
  const reagendada = falta.resultado_em !== null || Boolean(falta.solicitacao?.agendamento_ativo);
  const encerrada = falta.solicitacao?.status === 'CONCLUIDA' || falta.solicitacao?.status === 'CANCELADA';

  return (
    <article className="falta-card" aria-label={`Falta de ${falta.solicitacao?.nome_solicitante ?? ''}`}>
      <div className="falta-card__info">
        <p className="falta-card__nome">{falta.solicitacao?.nome_solicitante}</p>
        <p className="falta-card__protocolo">{falta.solicitacao?.protocolo}</p>
        {falta.solicitacao?.prioridade && <PrioridadeBadge prioridade={falta.solicitacao.prioridade} />}
        <p className="falta-card__quando">{quandoEraOAgendamento(falta)}</p>
        {paciente?.celular_mascarado && <p className="falta-card__telefone">{paciente.celular_mascarado}</p>}
        {falta.ultima_tentativa_contato && (
          <p className="falta-card__ultimo-contato">
            Último contato: <time dateTime={falta.ultima_tentativa_contato.realizada_em}>
              {formatarAgendamento(falta.ultima_tentativa_contato.realizada_em)}
            </time>
          </p>
        )}
      </div>
      <div className="falta-card__actions">
        <button type="button" className="button button--outline button--small" onClick={() => onRegistrarContato(falta)}>
          Registrar contato
        </button>
        {reagendada ? <span>Reagendada</span> : encerrada ? <span>Atendimento encerrado</span> : (
          <button type="button" className="button button--primary button--small" onClick={() => onReagendar(falta)}>
            Reagendar
          </button>
        )}
      </div>
    </article>
  );
}
