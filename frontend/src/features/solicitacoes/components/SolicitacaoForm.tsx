import { useEffect, useRef, useState } from 'react';
import type { Categoria, Prioridade } from '../types';
import { LABEL_CATEGORIA, LABEL_PRIORIDADE } from '../types';

function formatarCPF(valor: string): string {
  const numeros = valor.replace(/\D/g, '').slice(0, 11);
  if (numeros.length <= 3) return numeros;
  if (numeros.length <= 6) return `${numeros.slice(0, 3)}.${numeros.slice(3)}`;
  if (numeros.length <= 9) return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6)}`;
  return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9)}`;
}

/** Formato brasileiro (81) 9XXXX-XXXX, espelhando a regex de CriarSolicitacaoRequest no backend. */
function formatarCelular(valor: string): string {
  const numeros = valor.replace(/\D/g, '').slice(0, 11);
  if (numeros.length <= 2) return numeros.length ? `(${numeros}` : '';
  if (numeros.length <= 7) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, numeros.length - 4)}-${numeros.slice(-4)}`;
}

export interface SolicitacaoFormValues {
  nome_solicitante: string;
  cpf_solicitante: string;
  data_nascimento: string;
  categoria: Categoria | '';
  prioridade: Prioridade | '';
  descricao: string;
  justificativa_prioridade: string;
  /** Opcional; só é enviado ao criar (a edição de solicitações não altera o telefone do paciente). */
  celular: string;
}

interface FormErrors { [key: string]: string[] }

const FIELD_LABELS: Record<string, string> = {
  nome_solicitante: 'Nome do solicitante',
  cpf_solicitante: 'CPF',
  data_nascimento: 'Data de nascimento',
  categoria: 'Categoria',
  prioridade: 'Prioridade',
  descricao: 'Descrição',
  justificativa_prioridade: 'Justificativa da prioridade',
  celular: 'Celular',
};

const VALORES_VAZIOS: SolicitacaoFormValues = {
  nome_solicitante: '',
  cpf_solicitante: '',
  data_nascimento: '',
  categoria: '',
  prioridade: '',
  descricao: '',
  justificativa_prioridade: '',
  celular: '',
};

interface SolicitacaoFormProps {
  eyebrow: string;
  heading: string;
  description?: string;
  initialValues?: Partial<SolicitacaoFormValues>;
  submitLabel: string;
  submittingLabel?: string;
  /** Mostra o campo opcional de celular do paciente. Só faz sentido na criação. */
  mostrarCelular?: boolean;
  onSubmit: (values: SolicitacaoFormValues) => Promise<void>;
  onCancel: () => void;
}

export function SolicitacaoForm({
  eyebrow,
  heading,
  description,
  initialValues,
  submitLabel,
  submittingLabel = 'Salvando...',
  mostrarCelular = false,
  onSubmit,
  onCancel,
}: SolicitacaoFormProps) {
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  const [form, setForm] = useState<SolicitacaoFormValues>({
    ...VALORES_VAZIOS,
    ...initialValues,
  });

  useEffect(() => {
    if (globalError) errorSummaryRef.current?.focus();
  }, [globalError]);

  const set = (field: keyof SolicitacaoFormValues, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    setFieldErrors(current => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setGlobalError(null);
    setFieldErrors({});
    try {
      await onSubmit(form);
    } catch (error: unknown) {
      if (error instanceof Error && 'errors' in error) {
        const apiError = error as Error & { errors?: FormErrors };
        if (apiError.errors) setFieldErrors(apiError.errors);
      }
      setGlobalError(error instanceof Error ? error.message : 'Erro ao salvar solicitação');
    } finally {
      setSubmitting(false);
    }
  };

  const err = (field: string) => fieldErrors[field]?.[0];
  const describedBy = (field: string, helper?: string) => [helper, err(field) ? `${field}-error` : ''].filter(Boolean).join(' ') || undefined;

  return (
    <>
      <header className="page-heading page-heading--compact">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{heading}</h1>
          {description && <p className="page-heading__description">{description}</p>}
        </div>
      </header>

      {globalError && (
        <div className="alert alert--error alert--stacked" role="alert" tabIndex={-1} ref={errorSummaryRef}>
          <div>
            <strong>Revise os dados informados</strong>
            <p>{globalError}</p>
          </div>
          {Object.entries(fieldErrors).length > 0 && (
            <ul>
              {Object.entries(fieldErrors).map(([field, messages]) => (
                <li key={field}><a href={`#${field}`}>{FIELD_LABELS[field] ?? field}: {messages[0]}</a></li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        <section className="form-section" aria-labelledby="personal-heading">
          <div className="form-section__heading">
            <span>01</span>
            <div>
              <h2 id="personal-heading">Dados da pessoa solicitante</h2>
            </div>
          </div>

          <div className="field-grid">
            <div className="field field--full">
              <label htmlFor="nome_solicitante">Nome do Solicitante <span aria-hidden="true">*</span></label>
              <input id="nome_solicitante" value={form.nome_solicitante} onChange={event => set('nome_solicitante', event.target.value)} placeholder="Nome completo" maxLength={255} required aria-invalid={Boolean(err('nome_solicitante'))} aria-describedby={describedBy('nome_solicitante')} />
              {err('nome_solicitante') && <p id="nome_solicitante-error" className="field-error">{err('nome_solicitante')}</p>}
            </div>

            <div className="field">
              <label htmlFor="cpf_solicitante">CPF <span aria-hidden="true">*</span></label>
              <input id="cpf_solicitante" inputMode="numeric" autoComplete="off" value={form.cpf_solicitante} onChange={event => set('cpf_solicitante', formatarCPF(event.target.value))} placeholder="000.000.000-00" maxLength={14} required aria-invalid={Boolean(err('cpf_solicitante'))} aria-describedby={describedBy('cpf_solicitante', 'cpf-helper')} />
              <p id="cpf-helper" className="field-helper">Formato: 000.000.000-00</p>
              {err('cpf_solicitante') && <p id="cpf_solicitante-error" className="field-error">{err('cpf_solicitante')}</p>}
            </div>

            <div className="field">
              <label htmlFor="data_nascimento">Data de Nascimento <span aria-hidden="true">*</span></label>
              <input id="data_nascimento" type="date" value={form.data_nascimento} onChange={event => set('data_nascimento', event.target.value)} required aria-invalid={Boolean(err('data_nascimento'))} aria-describedby={describedBy('data_nascimento')} />
              {err('data_nascimento') && <p id="data_nascimento-error" className="field-error">{err('data_nascimento')}</p>}
            </div>

            {mostrarCelular && (
              <div className="field">
                <label htmlFor="celular">Celular (opcional)</label>
                <input id="celular" inputMode="tel" autoComplete="off" value={form.celular} onChange={event => set('celular', formatarCelular(event.target.value))} placeholder="(81) 99999-0000" maxLength={16} aria-invalid={Boolean(err('celular'))} aria-describedby={describedBy('celular', 'celular-helper')} />
                <p id="celular-helper" className="field-helper">Usado só para contato em caso de falta; sempre exibido mascarado no sistema.</p>
                {err('celular') && <p id="celular-error" className="field-error">{err('celular')}</p>}
              </div>
            )}
          </div>
        </section>

        <section className="form-section" aria-labelledby="request-heading">
          <div className="form-section__heading">
            <span>02</span>
            <div>
              <h2 id="request-heading">Informações da solicitação</h2>
              <p>Classifique o atendimento e forneça contexto suficiente para análise.</p>
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <label htmlFor="categoria">Categoria <span aria-hidden="true">*</span></label>
              <select id="categoria" value={form.categoria} onChange={event => set('categoria', event.target.value)} required aria-invalid={Boolean(err('categoria'))} aria-describedby={describedBy('categoria')}>
                <option value="">Selecione...</option>
                {(['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO'] as Categoria[]).map(item => <option key={item} value={item}>{LABEL_CATEGORIA[item]}</option>)}
              </select>
              {err('categoria') && <p id="categoria-error" className="field-error">{err('categoria')}</p>}
            </div>

            <div className="field">
              <label htmlFor="prioridade">Prioridade <span aria-hidden="true">*</span></label>
              <select id="prioridade" value={form.prioridade} onChange={event => set('prioridade', event.target.value)} required aria-invalid={Boolean(err('prioridade'))} aria-describedby={describedBy('prioridade')}>
                <option value="">Selecione...</option>
                {(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as Prioridade[]).map(item => <option key={item} value={item}>{LABEL_PRIORIDADE[item]}</option>)}
              </select>
              {err('prioridade') && <p id="prioridade-error" className="field-error">{err('prioridade')}</p>}
            </div>

            <div className="field field--full">
              <label htmlFor="descricao">Descrição <span aria-hidden="true">*</span></label>
              <textarea id="descricao" value={form.descricao} onChange={event => set('descricao', event.target.value)} placeholder="Descreva a solicitação de atendimento..." maxLength={2000} required aria-invalid={Boolean(err('descricao'))} aria-describedby={describedBy('descricao', 'descricao-helper')} />
              <p id="descricao-helper" className="field-helper">Até 2.000 caracteres.</p>
              {err('descricao') && <p id="descricao-error" className="field-error">{err('descricao')}</p>}
            </div>

            {form.prioridade === 'URGENTE' && (
              <div className="field field--full field--urgent">
                <label htmlFor="justificativa_prioridade">Justificativa da Prioridade Urgente <span aria-hidden="true">*</span></label>
                <textarea id="justificativa_prioridade" value={form.justificativa_prioridade} onChange={event => set('justificativa_prioridade', event.target.value)} placeholder="Explique objetivamente o motivo da urgência..." maxLength={1000} required aria-invalid={Boolean(err('justificativa_prioridade'))} aria-describedby={describedBy('justificativa_prioridade', 'justificativa-helper')} />
                <p id="justificativa-helper" className="field-helper">Obrigatória para prioridade urgente.</p>
                {err('justificativa_prioridade') && <p id="justificativa_prioridade-error" className="field-error">{err('justificativa_prioridade')}</p>}
              </div>
            )}
          </div>
        </section>

        <div className="form-actions">
          <button type="submit" disabled={submitting} className="button button--primary" aria-busy={submitting}>
            {submitting ? <><span className="spinner spinner--small" aria-hidden="true" /> {submittingLabel}</> : submitLabel}
          </button>
          <button type="button" onClick={onCancel} className="button button--outline">Cancelar</button>
        </div>
      </form>
    </>
  );
}
