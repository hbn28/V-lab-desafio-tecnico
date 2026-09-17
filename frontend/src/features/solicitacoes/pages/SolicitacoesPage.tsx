import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSolicitacoes } from '../hooks/useSolicitacoes';
import { StatusBadge, PrioridadeBadge } from '../../../components/Badge';
import type { Status, Categoria, Prioridade } from '../types';
import { LABEL_STATUS, LABEL_CATEGORIA, LABEL_PRIORIDADE } from '../types';

const STATUS_LIST: Status[] = ['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA'];
const CATEGORIA_LIST: Categoria[] = ['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO'];
const PRIORIDADE_LIST: Prioridade[] = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'];

export function SolicitacoesPage() {
  const [status, setStatus] = useState<Status | ''>('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [prioridade, setPrioridade] = useState<Prioridade | ''>('');
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useSolicitacoes({
    status: status || undefined,
    categoria: categoria || undefined,
    prioridade: prioridade || undefined,
    page,
    per_page: 10,
  });

  const select = (style?: React.CSSProperties): React.CSSProperties => ({
    padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db',
    fontSize: '0.875rem', background: '#fff', ...style,
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Solicitações de Atendimento</h1>
        <Link to="/solicitacoes/nova" style={{
          background: '#1a1a2e', color: '#fff', padding: '8px 16px',
          borderRadius: '6px', fontSize: '0.875rem', fontWeight: 600,
        }}>
          + Nova Solicitação
        </Link>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select style={select()} value={status} onChange={e => { setStatus(e.target.value as Status | ''); setPage(1); }}>
          <option value="">Todos os status</option>
          {STATUS_LIST.map(s => <option key={s} value={s}>{LABEL_STATUS[s]}</option>)}
        </select>
        <select style={select()} value={categoria} onChange={e => { setCategoria(e.target.value as Categoria | ''); setPage(1); }}>
          <option value="">Todas as categorias</option>
          {CATEGORIA_LIST.map(c => <option key={c} value={c}>{LABEL_CATEGORIA[c]}</option>)}
        </select>
        <select style={select()} value={prioridade} onChange={e => { setPrioridade(e.target.value as Prioridade | ''); setPage(1); }}>
          <option value="">Todas as prioridades</option>
          {PRIORIDADE_LIST.map(p => <option key={p} value={p}>{LABEL_PRIORIDADE[p]}</option>)}
        </select>
        {(status || categoria || prioridade) && (
          <button onClick={() => { setStatus(''); setCategoria(''); setPrioridade(''); setPage(1); }}
            style={{ ...select(), color: '#6b7280', background: 'transparent', border: '1px solid #d1d5db' }}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* Estado */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Carregando...</div>
      )}
      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', borderRadius: '8px', color: '#991b1b', marginBottom: '1rem' }}>
          {error} <button onClick={reload} style={{ marginLeft: '0.5rem', textDecoration: 'underline', background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      )}
      {!loading && !error && data?.data.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Nenhuma solicitação encontrada.</p>
          <Link to="/solicitacoes/nova" style={{ color: '#1a1a2e', textDecoration: 'underline' }}>Criar a primeira</Link>
        </div>
      )}

      {/* Tabela */}
      {!loading && !error && data && data.data.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                {['Protocolo', 'Solicitante', 'Categoria', 'Prioridade', 'Status', 'Data'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.map((s, i) => (
                <tr key={s.id}
                  style={{ borderBottom: i < data.data.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <Link to={`/solicitacoes/${s.id}`} style={{ color: '#1d4ed8', fontWeight: 500, fontFamily: 'monospace' }}>
                      {s.protocolo}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{s.nome_solicitante}</td>
                  <td style={{ padding: '10px 14px' }}>{LABEL_CATEGORIA[s.categoria]}</td>
                  <td style={{ padding: '10px 14px' }}><PrioridadeBadge prioridade={s.prioridade} /></td>
                  <td style={{ padding: '10px 14px' }}><StatusBadge status={s.status} /></td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>
                    {new Date(s.data_criacao).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginação */}
          {data.last_page > 1 && (
            <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                Total: {data.total} registros
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #d1d5db', background: page === 1 ? '#f9fafb' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                  ← Anterior
                </button>
                <span style={{ padding: '4px 10px', fontSize: '0.875rem' }}>
                  {page} / {data.last_page}
                </span>
                <button disabled={page === data.last_page} onClick={() => setPage(p => p + 1)}
                  style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #d1d5db', background: page === data.last_page ? '#f9fafb' : '#fff', cursor: page === data.last_page ? 'not-allowed' : 'pointer' }}>
                  Próximo →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
