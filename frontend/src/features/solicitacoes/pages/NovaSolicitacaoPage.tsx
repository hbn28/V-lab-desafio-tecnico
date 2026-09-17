import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { solicitacoesApi } from '../api/client';
import type { Categoria, Prioridade } from '../types';
import { LABEL_CATEGORIA, LABEL_PRIORIDADE } from '../types';

interface FormErrors { [key: string]: string[] }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: '6px',
  border: '1px solid #d1d5db', fontSize: '0.9rem', background: '#fff',
};
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.875rem', color: '#374151' };
const fieldStyle: React.CSSProperties = { marginBottom: '1rem' };
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: '0.8rem', marginTop: '3px' };

export function NovaSolicitacaoPage() {
  const navigate = useNavigate();
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

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setFieldErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setGlobalError(null);
    setFieldErrors({});
    try {
      const created = await solicitacoesApi.criar({
        nome_solicitante: form.nome_solicitante,
        cpf_solicitante: form.cpf_solicitante,
        data_nascimento: form.data_nascimento,
        categoria: form.categoria as import('../types').Categoria,
        prioridade: form.prioridade as import('../types').Prioridade,
        descricao: form.descricao,
        justificativa_prioridade: form.prioridade === 'URGENTE' ? form.justificativa_prioridade : undefined,
      });
      navigate(`/solicitacoes/${created.id}`);
    } catch (e: unknown) {
      if (e instanceof Error && 'errors' in e) {
        const apiError = e as Error & { errors?: FormErrors };
        if (apiError.errors) setFieldErrors(apiError.errors);
      }
      setGlobalError(e instanceof Error ? e.message : 'Erro ao criar solicitação');
    } finally {
      setSubmitting(false);
    }
  };

  const err = (field: string) => fieldErrors[field]?.[0];

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>Nova Solicitação</h1>

      {globalError && (
        <div style={{ padding: '1rem', background: '#fee2e2', borderRadius: '8px', color: '#991b1b', marginBottom: '1rem' }}>
          {globalError}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.5rem', maxWidth: '640px' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Nome do Solicitante *</label>
          <input style={{ ...inputStyle, borderColor: err('nome_solicitante') ? '#dc2626' : '#d1d5db' }}
            value={form.nome_solicitante} onChange={e => set('nome_solicitante', e.target.value)} placeholder="Nome completo" />
          {err('nome_solicitante') && <p style={errorStyle}>{err('nome_solicitante')}</p>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>CPF *</label>
            <input style={{ ...inputStyle, borderColor: err('cpf_solicitante') ? '#dc2626' : '#d1d5db' }}
              value={form.cpf_solicitante} onChange={e => set('cpf_solicitante', e.target.value)} placeholder="000.000.000-00" />
            {err('cpf_solicitante') && <p style={errorStyle}>{err('cpf_solicitante')}</p>}
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Data de Nascimento *</label>
            <input type="date" style={{ ...inputStyle, borderColor: err('data_nascimento') ? '#dc2626' : '#d1d5db' }}
              value={form.data_nascimento} onChange={e => set('data_nascimento', e.target.value)} />
            {err('data_nascimento') && <p style={errorStyle}>{err('data_nascimento')}</p>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Categoria *</label>
            <select style={{ ...inputStyle, borderColor: err('categoria') ? '#dc2626' : '#d1d5db' }}
              value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              <option value="">Selecione...</option>
              {(['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO'] as Categoria[]).map(c =>
                <option key={c} value={c}>{LABEL_CATEGORIA[c]}</option>)}
            </select>
            {err('categoria') && <p style={errorStyle}>{err('categoria')}</p>}
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Prioridade *</label>
            <select style={{ ...inputStyle, borderColor: err('prioridade') ? '#dc2626' : '#d1d5db' }}
              value={form.prioridade} onChange={e => set('prioridade', e.target.value)}>
              <option value="">Selecione...</option>
              {(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as Prioridade[]).map(p =>
                <option key={p} value={p}>{LABEL_PRIORIDADE[p]}</option>)}
            </select>
            {err('prioridade') && <p style={errorStyle}>{err('prioridade')}</p>}
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Descrição *</label>
          <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', borderColor: err('descricao') ? '#dc2626' : '#d1d5db' }}
            value={form.descricao} onChange={e => set('descricao', e.target.value)}
            placeholder="Descreva a solicitação de atendimento..." />
          {err('descricao') && <p style={errorStyle}>{err('descricao')}</p>}
        </div>

        {form.prioridade === 'URGENTE' && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Justificativa da Prioridade Urgente *</label>
            <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', borderColor: err('justificativa_prioridade') ? '#dc2626' : '#d1d5db' }}
              value={form.justificativa_prioridade} onChange={e => set('justificativa_prioridade', e.target.value)}
              placeholder="Justifique por que esta solicitação é urgente..." />
            {err('justificativa_prioridade') && <p style={errorStyle}>{err('justificativa_prioridade')}</p>}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="submit" disabled={submitting}
            style={{ padding: '10px 24px', background: '#1a1a2e', color: '#fff', borderRadius: '6px', border: 'none', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Salvando...' : 'Criar Solicitação'}
          </button>
          <button type="button" onClick={() => navigate('/solicitacoes')}
            style={{ padding: '10px 24px', background: 'transparent', color: '#6b7280', borderRadius: '6px', border: '1px solid #d1d5db' }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
