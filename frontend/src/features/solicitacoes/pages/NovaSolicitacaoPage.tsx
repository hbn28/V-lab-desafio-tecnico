import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { solicitacoesApi } from '../api/client';
import type { Categoria, Prioridade } from '../types';
import { LABEL_CATEGORIA, LABEL_PRIORIDADE } from '../types';

function formatarCPF(valor: string): string {
  const numeros = valor.replace(/\D/g, '').slice(0, 11);
  if (numeros.length <= 3) return numeros;
  if (numeros.length <= 6) return `${numeros.slice(0, 3)}.${numeros.slice(3)}`;
  if (numeros.length <= 9) return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6)}`;
  return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9)}`;
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
};

export function NovaSolicitacaoPage() {
  const navigate = useNavigate();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  const [form, setForm] = useState({
    nome_solicitante: '',
    cpf_solicitante: '',
    data_nascimento: '',
    categoria: '' as Categoria | '',
    prioridade: '' as Prioridade | '',
    descricao: '',
    justificativa_prioridade: '',
  });

  useEffect(() => {
    if (globalError) errorSummaryRef.current?.focus();
  }, [globalError]);

  const set = (field: string, value: string) => {
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
      const created = await solicitacoesApi.criar({
        nome_solicitante: form.nome_solicitante,
        cpf_solicitante: form.cpf_solicitante,
        data_nascimento: form.data_nascimento,
        categoria: form.categoria as Categoria,
        prioridade: form.prioridade as Prioridade,
        descricao: form.descricao,
        justificativa_prioridade: form.prioridade === 'URGENTE' ? form.justificativa_prioridade : undefined,
      });
      navigate(`/solicitacoes/${created.id}`);
    } catch (error: unknown) {
      if (error instanceof Error && 'errors' in error) {
        const apiError = error as Error & { errors?: FormErrors };
        if (apiError.errors) setFieldErrors(apiError.errors);
      }
      setGlobalError(error instanceof Error ? error.message : 'Erro ao criar solicitação');
    } finally {
      setSubmitting(false);
    }
  };

  const err = (field: string) => fieldErrors[field]?.[0];
  const describedBy = (field: string, helper?: string) => [helper, err(field) ? `${field}-error` : ''].filter(Boolean).join(' ') || undefined;

  return (
    <div className="page-stack page-stack--narrow">
      <nav className="breadcrumb" aria-label="Navegação estrutural">
        <Link to="/">Solicitações</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Nova solicitação</span>
      </nav>

      <header className="page-heading page-heading--compact">
        <div>
          <p className="eyebrow">Novo registro</p>
          <h1>Nova Solicitação</h1>
          <p className="page-heading__description">Cadastre dados fictícios e descreva a necessidade de atendimento com clareza.</p>
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
              <p>Use somente informações fictícias neste desafio.</p>
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
              <textarea id="descricao" value={form.descricao} onChange={event => set('descricao', event.target.value)} placeholder="Descreva a solicitação de atendimento..." minLength={10} maxLength={2000} required aria-invalid={Boolean(err('descricao'))} aria-describedby={describedBy('descricao', 'descricao-helper')} />
              <p id="descricao-helper" className="field-helper">Entre 10 e 2.000 caracteres.</p>
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
            {submitting ? <><span className="spinner spinner--small" aria-hidden="true" /> Salvando...</> : 'Criar solicitação'}
          </button>
          <button type="button" onClick={() => navigate('/')} className="button button--outline">Cancelar</button>
        </div>
      </form>
    </div>
  );
}
