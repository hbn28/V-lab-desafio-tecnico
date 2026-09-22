import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { AgendamentoPayload, Turno } from '../types';
import { LABEL_TURNO } from '../types';
import { AGENDAMENTO_TIMEZONE, derivarTurnoDaHora } from '../config/agendamento';

type Campo = 'data_agendada' | 'hora_agendada' | 'turno';
type Erros = Record<string, string[]>;
type Modalidade = 'HORARIO' | 'TURNO';

const TURNOS: Turno[] = ['MANHA', 'TARDE', 'NOITE'];

const ROTULOS: Record<Campo, string> = {
  data_agendada: 'Data do atendimento',
  hora_agendada: 'Horário do atendimento',
  turno: 'Turno do atendimento',
};

const OBRIGATORIO: Record<Campo, string> = {
  data_agendada: 'Informe a data do atendimento.',
  hora_agendada: 'Informe o horário do atendimento.',
  turno: 'Informe o turno do atendimento.',
};

function modalidadeInicial(initialValue?: AgendamentoPayload): Modalidade {
  return initialValue && 'turno' in initialValue && initialValue.turno ? 'TURNO' : 'HORARIO';
}

interface AgendamentoFormProps {
  /** `agendar` (EM_ANALISE → AGENDADA) ou `reagendar` (solicitação já AGENDADA). */
  mode?: 'agendar' | 'reagendar';
  initialValue?: AgendamentoPayload;
  submitting?: boolean;
  serverErrors?: Erros;
  /** Rótulo do botão de envio; sobrepõe o padrão derivado de `mode`. */
  submitLabel?: string;
  /** Contexto exibido acima dos campos (protocolo, categoria, prioridade). */
  context?: ReactNode;
  onSubmit: (payload: AgendamentoPayload) => void;
  onCancel: () => void;
}

export function AgendamentoForm({
  mode = 'agendar',
  initialValue,
  submitting = false,
  serverErrors = {},
  submitLabel,
  context,
  onSubmit,
  onCancel,
}: AgendamentoFormProps) {
  const resumoRef = useRef<HTMLDivElement>(null);
  const [modalidade, setModalidade] = useState<Modalidade>(() => modalidadeInicial(initialValue));
  const [dataAgendada, setDataAgendada] = useState(initialValue?.data_agendada ?? '');
  const [horaAgendada, setHoraAgendada] = useState(
    initialValue && 'hora_agendada' in initialValue ? initialValue.hora_agendada ?? '' : ''
  );
  const [turno, setTurno] = useState<Turno | ''>(
    initialValue && 'turno' in initialValue ? initialValue.turno ?? '' : ''
  );
  const [errosLocais, setErrosLocais] = useState<Partial<Record<Campo, string>>>({});
  const [tentativasInvalidas, setTentativasInvalidas] = useState(0);

  const temErroServidor = Object.keys(serverErrors).length > 0;

  useEffect(() => {
    if (tentativasInvalidas > 0 || temErroServidor) resumoRef.current?.focus();
  }, [tentativasInvalidas, serverErrors, temErroServidor]);

  const camposAtivos: Campo[] = modalidade === 'HORARIO'
    ? ['data_agendada', 'hora_agendada']
    : ['data_agendada', 'turno'];

  const erro = (campo: Campo) => errosLocais[campo] ?? serverErrors[campo]?.[0];

  const valorDoCampo = (campo: Campo): string =>
    campo === 'data_agendada' ? dataAgendada : campo === 'hora_agendada' ? horaAgendada : turno;

  const validar = (campo: Campo, valor: string) => {
    setErrosLocais(atual => {
      const proximo = { ...atual };
      if (valor === '') proximo[campo] = OBRIGATORIO[campo];
      else delete proximo[campo];
      return proximo;
    });
  };

  const limparErro = (campo: Campo) => {
    setErrosLocais(atual => {
      const proximo = { ...atual };
      delete proximo[campo];
      return proximo;
    });
  };

  const alterarModalidade = (proxima: Modalidade) => {
    setModalidade(proxima);
    setErrosLocais({});
  };

  const alterarData = (valor: string) => { setDataAgendada(valor); limparErro('data_agendada'); };
  const alterarHora = (valor: string) => { setHoraAgendada(valor); limparErro('hora_agendada'); };
  const alterarTurno = (valor: string) => { setTurno(valor as Turno); limparErro('turno'); };

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const invalidos = camposAtivos.filter(campo => valorDoCampo(campo) === '');
    if (invalidos.length > 0) {
      setErrosLocais(Object.fromEntries(invalidos.map(campo => [campo, OBRIGATORIO[campo]])));
      setTentativasInvalidas(n => n + 1);
      return;
    }
    if (modalidade === 'HORARIO') {
      onSubmit({ data_agendada: dataAgendada, hora_agendada: horaAgendada });
    } else {
      onSubmit({ data_agendada: dataAgendada, turno: turno as Turno });
    }
  };

  const resumo: Array<[string, string]> = [
    ...camposAtivos.filter(campo => erro(campo)).map((campo): [string, string] => [campo, erro(campo)!]),
    ...Object.entries(serverErrors)
      .filter(([campo]) => !(camposAtivos as string[]).includes(campo))
      .map(([campo, mensagens]): [string, string] => [campo, mensagens[0]]),
  ];

  const descrito = (campo: Campo) =>
    ['agendamento-fuso', erro(campo) ? `agendamento-${campo}-error` : ''].filter(Boolean).join(' ');

  const turnoDerivado = modalidade === 'HORARIO' ? derivarTurnoDaHora(horaAgendada) : null;

  return (
    <form className="schedule-form" onSubmit={enviar} noValidate>
      {context && <div className="schedule-form__context">{context}</div>}

      {resumo.length > 0 && (
        <div className="alert alert--error alert--stacked" role="alert" tabIndex={-1} ref={resumoRef}>
          <strong>Revise os dados do agendamento</strong>
          <ul>
            {resumo.map(([campo, mensagem]) => (
              <li key={campo}>
                <a href={`#agendamento-${campo}`}>{(ROTULOS as Record<string, string>)[campo] ?? campo}: {mensagem}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className="schedule-form__modalidade" disabled={submitting}>
        <legend>Modalidade do agendamento</legend>
        <label>
          <input
            type="radio"
            name="agendamento-modalidade"
            value="HORARIO"
            checked={modalidade === 'HORARIO'}
            onChange={() => alterarModalidade('HORARIO')}
          />
          Horário exato
        </label>
        <label>
          <input
            type="radio"
            name="agendamento-modalidade"
            value="TURNO"
            checked={modalidade === 'TURNO'}
            onChange={() => alterarModalidade('TURNO')}
          />
          Turno
        </label>
      </fieldset>

      <div className="schedule-form__fields field-grid" role="group" aria-label="Data e horário do atendimento" aria-busy={submitting}>
        <div className="field">
          <label htmlFor="agendamento-data_agendada">Data do atendimento</label>
          <input
            id="agendamento-data_agendada"
            type="date"
            value={dataAgendada}
            required
            disabled={submitting}
            aria-invalid={Boolean(erro('data_agendada'))}
            aria-describedby={descrito('data_agendada')}
            onChange={evento => alterarData(evento.target.value)}
            onBlur={evento => validar('data_agendada', evento.target.value)}
          />
          {erro('data_agendada') && <p id="agendamento-data_agendada-error" className="field-error">{erro('data_agendada')}</p>}
        </div>

        {modalidade === 'HORARIO' ? (
          <div className="field">
            <label htmlFor="agendamento-hora_agendada">Horário do atendimento</label>
            <input
              id="agendamento-hora_agendada"
              type="time"
              step={60}
              value={horaAgendada}
              required
              disabled={submitting}
              aria-invalid={Boolean(erro('hora_agendada'))}
              aria-describedby={descrito('hora_agendada')}
              onChange={evento => alterarHora(evento.target.value)}
              onBlur={evento => validar('hora_agendada', evento.target.value)}
            />
            {erro('hora_agendada') && <p id="agendamento-hora_agendada-error" className="field-error">{erro('hora_agendada')}</p>}
            {turnoDerivado && <p className="field-helper">Turno: {LABEL_TURNO[turnoDerivado]}</p>}
          </div>
        ) : (
          <div className="field">
            <label htmlFor="agendamento-turno">Turno do atendimento</label>
            <select
              id="agendamento-turno"
              value={turno}
              required
              disabled={submitting}
              aria-invalid={Boolean(erro('turno'))}
              aria-describedby={descrito('turno')}
              onChange={evento => alterarTurno(evento.target.value)}
              onBlur={evento => validar('turno', evento.target.value)}
            >
              <option value="">Selecione um turno</option>
              {TURNOS.map(item => (
                <option key={item} value={item}>{LABEL_TURNO[item]}</option>
              ))}
            </select>
            {erro('turno') && <p id="agendamento-turno-error" className="field-error">{erro('turno')}</p>}
          </div>
        )}

        <p id="agendamento-fuso" className="field-helper field--full">Horário local — {AGENDAMENTO_TIMEZONE}</p>
      </div>

      <div className="schedule-form__actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting
            ? <><span className="spinner spinner--small" aria-hidden="true" /> Salvando...</>
            : submitLabel ?? (mode === 'reagendar' ? 'Salvar novo horário' : 'Confirmar agendamento')}
        </button>
        <button type="button" className="button button--outline" onClick={onCancel}>Cancelar edição</button>
      </div>
    </form>
  );
}
