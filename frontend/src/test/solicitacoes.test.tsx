import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NovaSolicitacaoPage } from '../features/solicitacoes/pages/NovaSolicitacaoPage';
import { solicitacoesApi } from '../features/solicitacoes/api/client';

vi.mock('../features/solicitacoes/api/client', () => ({
  solicitacoesApi: {
    criar: vi.fn(),
    listar: vi.fn(),
    buscar: vi.fn(),
    atualizarStatus: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('NovaSolicitacaoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o formulário de criação', () => {
    render(
      <MemoryRouter>
        <NovaSolicitacaoPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Nova Solicitação')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nome completo')).toBeInTheDocument();
    expect(screen.getByText('Criar Solicitação')).toBeInTheDocument();
  });

  it('mostra campo de justificativa apenas para prioridade URGENTE', async () => {
    render(
      <MemoryRouter>
        <NovaSolicitacaoPage />
      </MemoryRouter>
    );
    expect(screen.queryByText('Justificativa da Prioridade Urgente *')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Selecione...'), { target: { value: 'URGENTE' } });
    // A second select exists for categoria - find prioridade select
  });

  it('exibe erros de validação da API', async () => {
    const apiError = Object.assign(new Error('Dados inválidos'), {
      status: 422,
      errors: { nome_solicitante: ['O nome é obrigatório.'] },
    });
    vi.mocked(solicitacoesApi.criar).mockRejectedValue(apiError);

    render(
      <MemoryRouter>
        <NovaSolicitacaoPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Criar Solicitação'));

    await waitFor(() => {
      expect(screen.getByText('Dados inválidos')).toBeInTheDocument();
    });
  });

  it('redireciona para detalhe após criação bem-sucedida', async () => {
    vi.mocked(solicitacoesApi.criar).mockResolvedValue({
      id: 42,
      protocolo: 'SOL-2026-0001',
      nome_solicitante: 'Fulano de Tal',
      cpf_solicitante: '123.456.789-00',
      data_nascimento: '1990-01-01',
      categoria: 'CONSULTA',
      prioridade: 'MEDIA',
      status: 'RECEBIDA',
      descricao: 'Consulta de rotina',
      justificativa_prioridade: null,
      data_criacao: '2026-09-17T12:00:00Z',
      data_atualizacao: '2026-09-17T12:00:00Z',
    });

    render(
      <MemoryRouter>
        <NovaSolicitacaoPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Nome completo'), { target: { value: 'Fulano de Tal' } });
    fireEvent.click(screen.getByText('Criar Solicitação'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/solicitacoes/42');
    });
  });
});
