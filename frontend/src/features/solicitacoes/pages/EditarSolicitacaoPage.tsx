import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSolicitacao } from '../hooks/useSolicitacoes';
import { solicitacoesApi } from '../api/client';
import { SolicitacaoForm } from '../components/SolicitacaoForm';
import { LABEL_STATUS } from '../types';
import type { Categoria, Prioridade } from '../types';

const ESTADOS_ENCERRADOS = ['CONCLUIDA', 'CANCELADA'];

export function EditarSolicitacaoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: unknown } | null)?.from;
  const returnTo = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.includes('\\')
    ? from
    : '/';
  const { data, loading, error, reload } = useSolicitacao(id ?? '');

  if (loading) {
    return (
      <div className="state-view state-view--page" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <strong>Carregando solicitação</strong>
        <p>Buscando os dados para edição.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert--error" role="alert">
        <div><strong>Não foi possível abrir esta solicitação</strong><p>{error}</p></div>
        <button onClick={reload} className="button button--outline" type="button">Tentar novamente</button>
      </div>
    );
  }

  if (!data) return null;

  if (ESTADOS_ENCERRADOS.includes(data.status)) {
    return (
      <div className="page-stack page-stack--narrow">
        <nav className="breadcrumb" aria-label="Navegação estrutural">
          <Link to={returnTo}>Solicitações</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/solicitacoes/${id}`} state={{ from: returnTo }}>{data.protocolo}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Editar</span>
        </nav>
        <div className="alert alert--error" role="alert">
          <div>
            <strong>Esta solicitação não pode ser editada</strong>
            <p>O status atual é <strong>{LABEL_STATUS[data.status]}</strong>. Solicitações em estado final não têm mais os dados cadastrais alterados.</p>
          </div>
          <Link to={`/solicitacoes/${id}`} state={{ from: returnTo }} className="button button--outline">Voltar aos detalhes</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack page-stack--narrow">
      <nav className="breadcrumb" aria-label="Navegação estrutural">
        <Link to={returnTo}>Solicitações</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/solicitacoes/${id}`} state={{ from: returnTo }}>{data.protocolo}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Editar</span>
      </nav>

      <SolicitacaoForm
        eyebrow="Edição de registro"
        heading={`Editar ${data.protocolo}`}
        description="Corrija os dados cadastrados. O protocolo e o status não são alterados por aqui."
        submitLabel="Salvar alterações"
        submittingLabel="Salvando alterações..."
        initialValues={{
          nome_solicitante: data.nome_solicitante,
          cpf_solicitante: data.cpf_solicitante,
          data_nascimento: data.data_nascimento,
          categoria: data.categoria,
          prioridade: data.prioridade,
          descricao: data.descricao,
          justificativa_prioridade: data.justificativa_prioridade ?? '',
        }}
        onCancel={() => navigate(`/solicitacoes/${id}`, { state: { from: returnTo } })}
        onSubmit={async values => {
          await solicitacoesApi.atualizar(id ?? '', {
            nome_solicitante: values.nome_solicitante,
            cpf_solicitante: values.cpf_solicitante,
            data_nascimento: values.data_nascimento,
            categoria: values.categoria as Categoria,
            prioridade: values.prioridade as Prioridade,
            descricao: values.descricao,
            justificativa_prioridade: values.prioridade === 'URGENTE' ? values.justificativa_prioridade : undefined,
          });
          navigate(`/solicitacoes/${id}`, { state: { from: returnTo } });
        }}
      />
    </div>
  );
}
