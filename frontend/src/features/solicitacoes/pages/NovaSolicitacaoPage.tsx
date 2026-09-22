import { Link, useNavigate } from 'react-router-dom';
import { solicitacoesApi } from '../api/client';
import { SolicitacaoForm } from '../components/SolicitacaoForm';
import type { Categoria, Prioridade } from '../types';

export function NovaSolicitacaoPage() {
  const navigate = useNavigate();

  return (
    <div className="page-stack page-stack--narrow">
      <nav className="breadcrumb" aria-label="Navegação estrutural">
        <Link to="/">Solicitações</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Nova solicitação</span>
      </nav>

      <SolicitacaoForm
        eyebrow="Novo registro"
        heading="Nova Solicitação"
        submitLabel="Criar solicitação"
        submittingLabel="Salvando..."
        mostrarCelular
        onCancel={() => navigate('/')}
        onSubmit={async values => {
          const created = await solicitacoesApi.criar({
            nome_solicitante: values.nome_solicitante,
            cpf_solicitante: values.cpf_solicitante,
            data_nascimento: values.data_nascimento,
            categoria: values.categoria as Categoria,
            prioridade: values.prioridade as Prioridade,
            descricao: values.descricao,
            justificativa_prioridade: values.prioridade === 'URGENTE' ? values.justificativa_prioridade : undefined,
            celular: values.celular.trim() ? values.celular : undefined,
          });
          navigate(`/solicitacoes/${created.id}`);
        }}
      />
    </div>
  );
}
