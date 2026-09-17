import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSolicitacao } from '../hooks/useSolicitacoes';
import { solicitacoesApi } from '../api/client';
import { StatusBadge, PrioridadeBadge } from '../../../components/Badge';
import { TRANSICOES_PERMITIDAS, LABEL_STATUS, LABEL_CATEGORIA } from '../types';
import type { Status } from '../types';

export function SolicitacaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useSolicitacao(id!);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleStatusChange = async (novoStatus: Status) => {
    if (!data) return;
    if (!window.confirm(`Confirmar mudança para "${LABEL_STATUS[novoStatus]}"?`)) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      await solicitacoesApi.atualizarStatus(data.id.toString(), novoStatus);
      await reload();
    } catch (e: unknown) {
      setUpdateError(e instanceof Error ? e.message : 'Erro ao atualizar status');
    } finally {
      setUpdating(false);
    }
  };

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', gap: '1rem', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ width: '200px', flexShrink: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>{label}</span>
      <span style={{ color: '#1a1a2e', fontSize: '0.875rem' }}>{value}</span>
    </div>
  );

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Carregando...</div>;
  if (error) return (
    <div style={{ padding: '1rem', background: '#fee2e2', borderRadius: '8px', color: '#991b1b' }}>
      {error} <button onClick={reload} style={{ marginLeft: '0.5rem', textDecoration: 'underline', background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer' }}>Tentar novamente</button>
    </div>
  );
  if (!data) return null;

  const transicoes = TRANSICOES_PERMITIDAS[data.status];

  return (
    <div>
      <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Link to="/solicitacoes" style={{ color: '#6b7280', fontSize: '0.875rem' }}>← Voltar</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#374151' }}>{data.protocolo}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Detalhes */}
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Detalhes da Solicitação</h1>
          {row('Protocolo', <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{data.protocolo}</span>)}
          {row('Solicitante', data.nome_solicitante)}
          {row('CPF', data.cpf_solicitante)}
          {row('Data de Nascimento', new Date(data.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR'))}
          {row('Categoria', LABEL_CATEGORIA[data.categoria])}
          {row('Prioridade', <PrioridadeBadge prioridade={data.prioridade} />)}
          {row('Status', <StatusBadge status={data.status} />)}
          {row('Descrição', data.descricao)}
          {data.justificativa_prioridade && row('Justificativa', data.justificativa_prioridade)}
          {row('Criada em', new Date(data.data_criacao).toLocaleString('pt-BR'))}
          {row('Atualizada em', new Date(data.data_atualizacao).toLocaleString('pt-BR'))}
        </div>

        {/* Ações de status */}
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Atualizar Status</h2>

          {updateError && (
            <div style={{ padding: '0.75rem', background: '#fee2e2', borderRadius: '6px', color: '#991b1b', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {updateError}
            </div>
          )}

          {transicoes.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Solicitação {data.status === 'CONCLUIDA' ? 'concluída' : 'cancelada'} — nenhuma transição disponível.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {transicoes.map(s => (
                <button key={s} disabled={updating} onClick={() => handleStatusChange(s)}
                  style={{
                    padding: '10px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
                    background: updating ? '#f9fafb' : '#f8fafc', cursor: updating ? 'not-allowed' : 'pointer',
                    fontWeight: 500, fontSize: '0.875rem', textAlign: 'left',
                    opacity: updating ? 0.7 : 1,
                  }}>
                  → {LABEL_STATUS[s]}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
            <button onClick={() => navigate('/solicitacoes')}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'transparent', fontSize: '0.875rem', color: '#6b7280', cursor: 'pointer' }}>
              ← Voltar à listagem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
