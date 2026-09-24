import type { FaltaListItem } from '../types';
import { descreverAgendamento, formatarAgendamento } from '../config/agendamento';

interface FaltaCardProps {
  falta: FaltaListItem;
  onRegistrarContato: (falta: FaltaListItem) => void;
  onReagendar: (falta: FaltaListItem) => void;
}

export function FaltaCard({ falta, onRegistrarContato, onReagendar }: FaltaCardProps) {
  const paciente = falta.solicitacao?.paciente;

  return (
    <article className="falta-card" aria-label={`Falta de ${falta.solicitacao?.nome_solicitante ?? ''}`}>
      <div className="falta-card__info">
        <p className="falta-card__nome">{falta.solicitacao?.nome_solicitante}</p>
        <p className="falta-card__protocolo">{falta.solicitacao?.protocolo}</p>
        <p className="falta-card__quando">Faltou ao atendimento de {descreverAgendamento(falta)}</p>
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
        <button type="button" className="button button--primary button--small" onClick={() => onReagendar(falta)}>
          Reagendar
        </button>
      </div>
    </article>
  );
}
