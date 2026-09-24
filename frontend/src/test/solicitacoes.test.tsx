import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from '../App';
import { NovaSolicitacaoPage } from '../features/solicitacoes/pages/NovaSolicitacaoPage';
import { SolicitacoesPage } from '../features/solicitacoes/pages/SolicitacoesPage';
import { SolicitacaoDetailPage } from '../features/solicitacoes/pages/SolicitacaoDetailPage';
import { solicitacoesApi } from '../features/solicitacoes/api/client';
import type { Solicitacao } from '../features/solicitacoes/types';

vi.mock('../features/auth/api/client', () => ({
  authApi: {
    me: vi.fn().mockResolvedValue({ id: 1, name: 'Operador de teste', email: 'operador@example.test', role: 'ADMINISTRADOR' }),
    login: vi.fn(),
    logout: vi.fn(),
  },
  csrfHeader: () => ({}),
}));

vi.mock('../features/solicitacoes/api/client', () => ({
  solicitacoesApi: {
    criar: vi.fn(),
    listar: vi.fn(),
    resumo: vi.fn(),
    buscar: vi.fn(),
    atualizarStatus: vi.fn(),
    reagendar: vi.fn(),
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
  agendado_para: null,
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
      cpf_solicitante: '***.456.789-**',
      categoria: 'CONSULTA',
      prioridade: 'MEDIA',
      status: 'RECEBIDA',
      agendado_para: null,
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
  const resumoMock = {
    status: { RECEBIDA: 1, EM_ANALISE: 1, AGENDADA: 0, CONCLUIDA: 1, CANCELADA: 0 },
    prioridade_aberta: { URGENTE: 1, ALTA: 1, MEDIA: 0, BAIXA: 0 },
    mais_antiga_aberta: { URGENTE: '2026-09-17T08:00:00Z', ALTA: '2026-09-17T09:00:00Z', MEDIA: null, BAIXA: null },
    total: 3,
    filtros_aplicados: { categoria: null, prioridade: null },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(solicitacoesApi.resumo).mockResolvedValue(resumoMock);
    // Próximo atendimento consulta a mesma listagem com status_grupo=aberto — cada teste
    // que precisa de outro comportamento sobrescreve com o seu próprio mockResolvedValue.
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({ data: [], total: 0, last_page: 1 });
  });

  it('destaca prioridades abertas com contagem global, separadas do andamento da fila', async () => {
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({
      data: [
        { ...solicitacaoBase, prioridade: 'URGENTE' },
        { ...solicitacaoBase, id: 2, protocolo: 'SOL-2026-0002', prioridade: 'ALTA', status: 'EM_ANALISE' },
        { ...solicitacaoBase, id: 3, protocolo: 'SOL-2026-0003', prioridade: 'URGENTE', status: 'CONCLUIDA' },
      ],
      total: 3,
      last_page: 1,
    });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Prioridades em aberto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 solicitação urgente em aberto/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 solicitação de prioridade alta em aberto/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 solicitação recebida/ })).toHaveTextContent('Recebidas');
    expect(screen.getByRole('button', { name: /1 solicitação em análise/ })).toHaveTextContent('Em análise');
  });

  it('mostra a fila paginada antes do resumo de prioridades', async () => {
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({
      data: [{ ...solicitacaoBase, prioridade: 'URGENTE' }],
      total: 1,
      last_page: 1,
    });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    const fila = await screen.findByRole('heading', { name: 'Fila de atendimento' });
    const prioridades = screen.getByRole('heading', { name: 'Prioridades em aberto' });

    expect(fila.compareDocumentPosition(prioridades) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText('Ordenar por')).toHaveValue('prioridade');
  });

  it('carrega a tabela inicial apenas com solicitações em aberto', async () => {
    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Fila de atendimento' });
    expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({
      per_page: 10,
      status_grupo: 'aberto',
    }));
  });

  it('filtra a fila por AGENDADA e ordena por horário, com filtro de dia opcional (ADR 003)', async () => {
    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Fila de atendimento' });
    expect(screen.queryByLabelText('Data agendada')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'AGENDADA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByLabelText('Ordenar por')).toHaveValue('horario');
    await waitFor(() => {
      expect(solicitacoesApi.listar).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'AGENDADA',
        status_grupo: 'aberto',
        data_agendada: undefined,
      }));
    });

    const campoData = screen.getByLabelText('Data agendada');
    fireEvent.change(campoData, { target: { value: '2026-09-25' } });
    await waitFor(() => {
      expect(solicitacoesApi.listar).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'AGENDADA',
        data_agendada: '2026-09-25',
      }));
    });

    // Trocar para outro status descarta o filtro de dia (só faz sentido com AGENDADA).
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'RECEBIDA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.queryByLabelText('Data agendada')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(solicitacoesApi.listar).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'RECEBIDA',
        data_agendada: undefined,
      }));
    });
  });

  it('abre o drill-down com a lista filtrada ao clicar em um bloco de prioridade', async () => {
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({
      data: [{ ...solicitacaoBase, prioridade: 'URGENTE' }],
      total: 1,
      last_page: 1,
    });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /1 solicitação urgente em aberto/ }));

    // Título do drill-down passou a ser uma frase só (sem eyebrow duplicada em cima).
    expect(await screen.findByRole('heading', { name: '1 solicitação urgente em aberto' })).toBeInTheDocument();
    await waitFor(() => {
      expect(solicitacoesApi.listar).toHaveBeenCalledWith(
        expect.objectContaining({ prioridade: 'URGENTE', status_grupo: 'aberto', per_page: 10, ordenar_por: 'data' })
      );
    });
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('SOL-2026-0001')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '1 solicitação urgente em aberto' })).not.toBeInTheDocument();
    });
  });

  it('abre o drill-down por status ao clicar em um bloco do andamento da fila', async () => {
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({
      data: [{ ...solicitacaoBase, status: 'RECEBIDA' }],
      total: 1,
      last_page: 1,
    });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /1 solicitação recebida/ }));

    expect(await screen.findByRole('heading', { name: 'Recebidas' })).toBeInTheDocument();
    await waitFor(() => {
      expect(solicitacoesApi.listar).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RECEBIDA', per_page: 10, ordenar_por: 'prioridade' })
      );
    });
  });

  it('mostra todas as etapas na tira compacta, incluindo as encerradas, e destaca a etapa filtrada', async () => {
    vi.mocked(solicitacoesApi.resumo).mockResolvedValue({
      status: { RECEBIDA: 1, EM_ANALISE: 0, AGENDADA: 1, CONCLUIDA: 0, CANCELADA: 0 },
      prioridade_aberta: { URGENTE: 0, ALTA: 2, MEDIA: 0, BAIXA: 0 },
      mais_antiga_aberta: { URGENTE: null, ALTA: '2026-09-16T08:00:00Z', MEDIA: null, BAIXA: null },
      total: 2,
      filtros_aplicados: { categoria: null, prioridade: 'ALTA' },
    });
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({ data: [], total: 0, last_page: 1 });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /^Histórico$/ }));
    fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'CONCLUIDA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    const concluidas = await screen.findByRole('button', { name: /0 solicitações concluídas/ });
    expect(concluidas).toHaveTextContent('Concluídas');
    expect(concluidas).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /0 solicitações canceladas/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 solicitação recebida/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('informa no painel qual filtro está sendo considerado e propaga para o resumo e o drill-down', async () => {
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({
      data: [{ ...solicitacaoBase, prioridade: 'URGENTE', categoria: 'EXAME' }],
      total: 1,
      last_page: 1,
    });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    expect(screen.queryByText(/todas as solicitações/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'EXAME' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => {
      expect(solicitacoesApi.resumo).toHaveBeenCalledWith(
        expect.objectContaining({ categoria: 'EXAME' })
      );
    });
    expect(screen.queryByText(/categoria Exame/)).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /solicitação urgente em aberto/ }));
    await waitFor(() => {
      expect(solicitacoesApi.listar).toHaveBeenCalledWith(
        expect.objectContaining({ prioridade: 'URGENTE', status_grupo: 'aberto', categoria: 'EXAME' })
      );
    });
  });

  it('usa o primeiro item da fila como próxima ação sem repetir um cartão', async () => {
    vi.mocked(solicitacoesApi.listar).mockImplementation(async filtros => {
      if (filtros?.per_page === 10) {
        return { data: [{ ...solicitacaoBase, prioridade: 'URGENTE' }], total: 1, last_page: 1 };
      }
      return { data: [], total: 0, last_page: 1 };
    });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('link', { name: 'Ver detalhes da solicitação SOL-2026-0001' })).toHaveAttribute('href', '/solicitacoes/1');
    expect(screen.queryByText('Próxima solicitação por prioridade')).not.toBeInTheDocument();
    expect(screen.queryByText(/Fila vazia/)).not.toBeInTheDocument();
  });

  it('mostra o horário agendado na primeira linha da fila, sem cartão duplicado', async () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(solicitacoesApi.listar).mockImplementation(async filtros => {
      if (filtros?.status === 'AGENDADA') return { data: [{ ...solicitacaoBase, status: 'AGENDADA', agendado_para: ontem }], total: 1, last_page: 1 };
      return { data: [], total: 0, last_page: 1 };
    });

    render(
      <MemoryRouter initialEntries={['/?visao=fila&status=AGENDADA']}>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('SOL-2026-0001')).toBeInTheDocument();
    expect(screen.queryByText(/Próxima solicitação por prioridade/)).not.toBeInTheDocument();
    expect(document.querySelector('time')).toHaveAttribute('dateTime', ontem);
  });

  it('mostra mensagem de fila vazia quando não há solicitações em aberto', async () => {
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({ data: [], total: 0, last_page: 1 });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Nenhuma solicitação cadastrada')).toBeInTheDocument();
    expect(screen.queryByText('Próxima solicitação por prioridade')).not.toBeInTheDocument();
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
    vi.mocked(solicitacoesApi.resumo).mockResolvedValue({
      status: { RECEBIDA: 0, EM_ANALISE: 0, AGENDADA: 0, CONCLUIDA: 0, CANCELADA: 0 },
      prioridade_aberta: { URGENTE: 0, ALTA: 0, MEDIA: 0, BAIXA: 0 },
      mais_antiga_aberta: { URGENTE: null, ALTA: null, MEDIA: null, BAIXA: null },
      total: 0,
      filtros_aplicados: { categoria: null, prioridade: null },
    });
  });

  it('mantém o dashboard na rota inicial definida pelo contrato', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Solicitações de Atendimento' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
