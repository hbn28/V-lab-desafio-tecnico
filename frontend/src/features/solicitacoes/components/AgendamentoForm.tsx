import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { AgendamentoPayload } from '../types';
import { AGENDAMENTO_TIMEZONE } from '../config/agendamento';

type Campo = keyof AgendamentoPayload;
type Erros = Record<string, string[]>;

const CAMPOS: Campo[] = ['data_agendada', 'hora_agendada'];

const ROTULOS: Record<Campo, string> = {
  data_agendada: 'Data do atendimento',
  hora_agendada: 'Horário do atendimento',
};

const OBRIGATORIO: Record<Campo, string> = {
  data_agendada: 'Informe a data do atendimento.',
  hora_agendada: 'Informe o horário do atendimento.',
};

interface AgendamentoFormProps {
  /** `agendar` (EM_ANALISE → AGENDADA) ou `reagendar` (solicitação já AGENDADA). */
  mode?: 'agendar' | 'reagendar';
  initialValue?: AgendamentoPayload;
  submitting: boolean;
  serverErrors: Erros;
  /** Contexto exibido acima dos campos (protocolo, categoria, prioridade). */
  context?: ReactNode;
  onSubmit: (payload: AgendamentoPayload) => void;
  onCancel: () => void;
}

export function AgendamentoForm({
  mode = 'agendar',
  initialValue,
  submitting,
  serverErrors,
  context,
  onSubmit,
  onCancel,
}: AgendamentoFormProps) {
  const resumoRef = useRef<HTMLDivElement>(null);
  const [valores, setValores] = useState<AgendamentoPayload>({
    data_agendada: initialValue?.data_agendada ?? '',
    hora_agendada: initialValue?.hora_agendada ?? '',
  });
  const [errosLocais, setErrosLocais] = useState<Partial<Record<Campo, string>>>({});
  const [tentativasInvalidas, setTentativasInvalidas] = useState(0);

  const temErroServidor = Object.keys(serverErrors).length > 0;

  useEffect(() => {
    if (tentativasInvalidas > 0 || temErroServidor) resumoRef.current?.focus();
  }, [tentativasInvalidas, serverErrors, temErroServidor]);

  const erro = (campo: Campo) => errosLocais[campo] ?? serverErrors[campo]?.[0];

  const validar = (campo: Campo, valor: string) => {
    setErrosLocais(atual => {
      const proximo = { ...atual };
      if (valor === '') proximo[campo] = OBRIGATORIO[campo];
      else delete proximo[campo];
      return proximo;
    });
  };

  const alterar = (campo: Campo, valor: string) => {
    setValores(atual => ({ ...atual, [campo]: valor }));
    setErrosLocais(atual => {
      const proximo = { ...atual };
      delete proximo[campo];
      return proximo;
    });
  };

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const invalidos = CAMPOS.filter(campo => valores[campo] === '');
    if (invalidos.length > 0) {
      setErrosLocais(Object.fromEntries(invalidos.map(campo => [campo, OBRIGATORIO[campo]])));
      setTentativasInvalidas(n => n + 1);
      return;
    }
    onSubmit(valores);
  };

  const resumo: Array<[string, string]> = [
    ...CAMPOS.filter(campo => erro(campo)).map((campo): [string, string] => [campo, erro(campo)!]),
    ...Object.entries(serverErrors)
      .filter(([campo]) => !(CAMPOS as string[]).includes(campo))
      .map(([campo, mensagens]): [string, string] => [campo, mensagens[0]]),
  ];

  const descrito = (campo: Campo) =>
    ['agendamento-fuso', erro(campo) ? `agendamento-${campo}-error` : ''].filter(Boolean).join(' ');

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

      <div className="schedule-form__fields field-grid" role="group" aria-label="Data e horário do atendimento" aria-busy={submitting}>
        <div className="field">
          <label htmlFor="agendamento-data_agendada">Data do atendimento</label>
          <input
            id="agendamento-data_agendada"
            type="date"
            value={valores.data_agendada}
            required
            disabled={submitting}
            aria-invalid={Boolean(erro('data_agendada'))}
            aria-describedby={descrito('data_agendada')}
            onChange={evento => alterar('data_agendada', evento.target.value)}
            onBlur={evento => validar('data_agendada', evento.target.value)}
          />
          {erro('data_agendada') && <p id="agendamento-data_agendada-error" className="field-error">{erro('data_agendada')}</p>}
        </div>

        <div className="field">
          <label htmlFor="agendamento-hora_agendada">Horário do atendimento</label>
          <input
            id="agendamento-hora_agendada"
            type="time"
            step={60}
            value={valores.hora_agendada}
            required
            disabled={submitting}
            aria-invalid={Boolean(erro('hora_agendada'))}
            aria-describedby={descrito('hora_agendada')}
            onChange={evento => alterar('hora_agendada', evento.target.value)}
            onBlur={evento => validar('hora_agendada', evento.target.value)}
          />
          {erro('hora_agendada') && <p id="agendamento-hora_agendada-error" className="field-error">{erro('hora_agendada')}</p>}
        </div>

        <p id="agendamento-fuso" className="field-helper field--full">Horário local — {AGENDAMENTO_TIMEZONE}</p>
      </div>

      <div className="schedule-form__actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting
            ? <><span className="spinner spinner--small" aria-hidden="true" /> Salvando...</>
            : mode === 'reagendar' ? 'Salvar novo horário' : 'Confirmar agendamento'}
        </button>
        <button type="button" className="button button--outline" onClick={onCancel}>Cancelar edição</button>
      </div>
    </form>
  );
}
