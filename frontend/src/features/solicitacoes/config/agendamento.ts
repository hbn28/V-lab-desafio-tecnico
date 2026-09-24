import type { Agendamento, AgendamentoPayload } from '../types';
import { LABEL_TURNO } from '../types';

/** Fuso operacional da agenda; deve coincidir com AGENDAMENTO_TIMEZONE no backend. */
export const AGENDAMENTO_TIMEZONE: string = import.meta.env.VITE_AGENDAMENTO_TIMEZONE || 'America/Recife';

const formatadorCompleto = new Intl.DateTimeFormat('pt-BR', {
  timeZone: AGENDAMENTO_TIMEZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});

const formatadorPartes = new Intl.DateTimeFormat('en-CA', {
  timeZone: AGENDAMENTO_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function partes(instante: Date): Record<string, string> {
  return Object.fromEntries(
    formatadorPartes.formatToParts(instante).map(parte => [parte.type, parte.value])
  );
}

/** Ex.: "25/09/2026 14:30", no fuso operacional. */
export function formatarAgendamento(iso: string): string {
  return formatadorCompleto.format(new Date(iso));
}

/** Data e hora locais (YYYY-MM-DD / HH:mm) de um instante ISO, no fuso operacional. */
export function camposDoAgendamento(iso: string): { data_agendada: string; hora_agendada: string } {
  const p = partes(new Date(iso));
  return { data_agendada: `${p.year}-${p.month}-${p.day}`, hora_agendada: `${p.hour}:${p.minute}` };
}

/** Dia atual (YYYY-MM-DD) no fuso operacional. */
export function dataHojeNoFuso(agora: Date = new Date()): string {
  const p = partes(agora);
  return `${p.year}-${p.month}-${p.day}`;
}

/** true somente para YYYY-MM-DD que sobrevive a uma construção UTC sem normalização (rejeita 2026-02-31). */
export function dataIsoValida(value: string | null): value is string {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [ano, mes, dia] = value.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

/** Deriva o turno (MANHA/TARDE/NOITE) a partir de um horário HH:mm, espelhando TurnoAgendamento::derivarDaHora no backend. */
export function derivarTurnoDaHora(hora: string): 'MANHA' | 'TARDE' | 'NOITE' | null {
  if (!/^\d{2}:\d{2}$/.test(hora)) return null;
  const h = Number(hora.slice(0, 2));
  if (Number.isNaN(h)) return null;
  if (h >= 6 && h < 12) return 'MANHA';
  if (h >= 12 && h < 18) return 'TARDE';
  return 'NOITE';
}

/**
 * "25/09/2026" a partir de uma data local "2026-09-25", sem passar por Date (o fuso do
 * navegador poderia empurrar o dia). Tolera um instante ISO usando só a parte da data.
 */
export function formatarDataLocal(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

type DadosAgendamento = Pick<Agendamento, 'modalidade' | 'data_agendada' | 'hora_agendada' | 'turno'>;

/**
 * "25/09/2026 às 14:30" ou "25/09/2026 · turno da manhã". data_agendada e hora_agendada
 * já estão no fuso operacional: são exibidas como vieram, sem conversão.
 */
export function descreverAgendamento(agendamento: DadosAgendamento): string {
  const data = formatarDataLocal(agendamento.data_agendada);
  if (agendamento.modalidade === 'HORARIO' && agendamento.hora_agendada) {
    return `${data} às ${agendamento.hora_agendada}`;
  }
  return `${data} · turno da ${LABEL_TURNO[agendamento.turno].toLowerCase()}`;
}

/** Valores iniciais do formulário de reagendamento a partir do agendamento ativo. */
export function payloadDoAgendamento(agendamento: DadosAgendamento): AgendamentoPayload {
  if (agendamento.modalidade === 'HORARIO' && agendamento.hora_agendada) {
    return { data_agendada: agendamento.data_agendada, hora_agendada: agendamento.hora_agendada };
  }
  return { data_agendada: agendamento.data_agendada, turno: agendamento.turno };
}
