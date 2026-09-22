import type { Solicitacao, Turno } from '../types';
import { LABEL_TURNO } from '../types';
import { formatarAgendamento } from '../config/agendamento';

interface GrupoTurnoAgendaProps {
  turno: Turno;
  agendamentos: Solicitacao[];
}

/** Agrupa os itens da agenda de um turno: horários exatos primeiro (ordenados), turno puro depois. */
export function GrupoTurnoAgenda({ turno, agendamentos }: GrupoTurnoAgendaProps) {
  const comHorario = agendamentos
    .filter(item => item.agendamento_ativo?.modalidade === 'HORARIO')
    .sort((a, b) => (a.agendamento_ativo?.hora_agendada ?? '').localeCompare(b.agendamento_ativo?.hora_agendada ?? ''));
  const somenteTurno = agendamentos.filter(item => item.agendamento_ativo?.modalidade === 'TURNO');

  if (agendamentos.length === 0) return null;

  return (
    <section className="turno-group" aria-labelledby={`turno-${turno}-heading`}>
      <h3 id={`turno-${turno}-heading`}>{LABEL_TURNO[turno]}</h3>
      <ul className="turno-group__list">
        {[...comHorario, ...somenteTurno].map(item => (
          <li key={item.id} className="turno-group__item">
            <span className="protocol-link">{item.protocolo}</span>
            <span className="requester-name">{item.nome_solicitante}</span>
            {item.agendamento_ativo?.modalidade === 'HORARIO' && item.agendado_para && (
              <time dateTime={item.agendado_para}>{formatarAgendamento(item.agendado_para)}</time>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
