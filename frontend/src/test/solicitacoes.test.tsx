import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from '../App';
import { NovaSolicitacaoPage } from '../features/solicitacoes/pages/NovaSolicitacaoPage';
import { SolicitacoesPage } from '../features/solicitacoes/pages/SolicitacoesPage';
import { SolicitacaoDetailPage } from '../features/solicitacoes/pages/SolicitacaoDetailPage';
import { solicitacoesApi } from '../features/solicitacoes/api/client';
import type { Solicitacao } from '../features/solicitacoes/types';

vi.mock('../features/solicitacoes/api/client', () => ({
  solicitacoesApi: {
    criar: vi.fn(),
    listar: vi.fn(),
    buscar: vi.fn(),
    atualizarStatus: vi.fn(),
    atualizar: vi.fn(),
    apagar: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const solicitacaoBase: Solicitacao = {
  id: 1,
  protocolo: 'SOL-2026-0001',
  nome_solicitante: 'Maria da Silva',
  cpf_solicitante: '123.456.789-00',
  data_nascimento: '1985-06-15',
  categoria: 'CONSULTA',
  prioridade: 'MEDIA',
  status: 'RECEBIDA',
  descricao: 'Consulta de rotina para acompanhamento.',
  justificativa_prioridade: null,
  data_criacao: '2026-09-17T12:00:00Z',
  data_atualizacao: '2026-09-17T12:00:00Z',
};

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
    expect(screen.getByRole('button', { name: /criar solicitação/i })).toBeInTheDocument();
  });

  it('mostra campo de justificativa apenas para prioridade URGENTE', async () => {
    render(
      <MemoryRouter>
        <NovaSolicitacaoPage />
      </MemoryRouter>
    );
    expect(screen.queryByLabelText(/Justificativa da Prioridade Urgente/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Prioridade/), { target: { value: 'URGENTE' } });

    expect(screen.getByLabelText(/Justificativa da Prioridade Urgente/)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /criar solicitação/i }));

    await waitFor(() => {
      expect(screen.getByText('Dados inválidos')).toBeInTheDocument();
    });

    const errorSummary = screen.getByRole('alert');
    expect(errorSummary).toHaveFocus();
    expect(screen.getByRole('link', { name: /Nome do solicitante: O nome é obrigatório/i })).toHaveAttribute('href', '#nome_solicitante');
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
    fireEvent.click(screen.getByRole('button', { name: /criar solicitação/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/solicitacoes/42');
    });
  });
});

describe('SolicitacoesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resume por status as solicitações visíveis na página carregada', async () => {
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({
      data: [
        solicitacaoBase,
        { ...solicitacaoBase, id: 2, protocolo: 'SOL-2026-0002' },
        { ...solicitacaoBase, id: 3, protocolo: 'SOL-2026-0003', status: 'EM_ANALISE' },
      ],
      total: 3,
      last_page: 1,
    });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Resumo desta página' })).toBeInTheDocument();
    expect(screen.getByLabelText('2 solicitações recebidas')).toBeInTheDocument();
    expect(screen.getByLabelText('1 solicitação em análise')).toBeInTheDocument();
  });
});

describe('SolicitacaoDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderDetalhe(solicitacao: Solicitacao) {
    vi.mocked(solicitacoesApi.buscar).mockResolvedValue(solicitacao);
    return render(
      <MemoryRouter initialEntries={[`/solicitacoes/${solicitacao.id}`]}>
        <Routes>
          <Route path="/solicitacoes/:id" element={<SolicitacaoDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('mostra o botão Editar quando a solicitação ainda está em aberto', async () => {
    renderDetalhe({ ...solicitacaoBase, status: 'RECEBIDA' });

    expect(await screen.findByRole('link', { name: 'Editar' })).toBeInTheDocument();
  });

  it('esconde o botão Editar quando a solicitação está em estado final', async () => {
    renderDetalhe({ ...solicitacaoBase, status: 'CONCLUIDA' });

    await screen.findByRole('heading', { name: 'SOL-2026-0001' });
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('pede confirmação e apaga a solicitação ao clicar em Apagar', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(solicitacoesApi.apagar).mockResolvedValue(undefined);
    renderDetalhe({ ...solicitacaoBase, status: 'RECEBIDA' });

    fireEvent.click(await screen.findByRole('button', { name: 'Apagar' }));

    await waitFor(() => {
      expect(solicitacoesApi.apagar).toHaveBeenCalledWith('1');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/');
    confirmSpy.mockRestore();
  });

  it('não apaga a solicitação se a confirmação for cancelada', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderDetalhe({ ...solicitacaoBase, status: 'RECEBIDA' });

    fireEvent.click(await screen.findByRole('button', { name: 'Apagar' }));

    await waitFor(() => {
      expect(solicitacoesApi.apagar).not.toHaveBeenCalled();
    });
    confirmSpy.mockRestore();
  });
});

describe('Rotas da aplicação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({ data: [], total: 0, last_page: 1 });
  });

  it('mantém o dashboard na rota inicial definida pelo contrato', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Solicitações de Atendimento' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
