import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
      cpf_solicitante: '123.456.789-00',
      data_nascimento: '1990-01-01',
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
    expect(screen.getByText('Registros ordenados pela prioridade e pelo tempo de espera.')).toBeInTheDocument();
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
    expect(screen.queryByLabelText('Data agendada (opcional)')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'AGENDADA' } });

    expect(screen.getByText('Já têm horário marcado: ordenadas por horário e, no empate, por prioridade.')).toBeInTheDocument();
    await waitFor(() => {
      expect(solicitacoesApi.listar).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'AGENDADA',
        status_grupo: 'aberto',
        data_agendada: undefined,
      }));
    });

    const campoData = screen.getByLabelText('Data agendada (opcional)');
    fireEvent.change(campoData, { target: { value: '2026-09-25' } });
    await waitFor(() => {
      expect(solicitacoesApi.listar).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'AGENDADA',
        data_agendada: '2026-09-25',
      }));
    });

    // Trocar para outro status descarta o filtro de dia (só faz sentido com AGENDADA).
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'RECEBIDA' } });
    expect(screen.queryByLabelText('Data agendada (opcional)')).not.toBeInTheDocument();
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
        expect.objectContaining({ prioridade: 'URGENTE', status_grupo: 'aberto', per_page: 50 })
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
        expect.objectContaining({ status: 'RECEBIDA', per_page: 50 })
      );
    });
  });

  it('mostra todas as etapas na tira compacta, incluindo as encerradas, e abre o drill-down de uma etapa encerrada', async () => {
    vi.mocked(solicitacoesApi.resumo).mockResolvedValue({
      status: { RECEBIDA: 1, EM_ANALISE: 0, AGENDADA: 1, CONCLUIDA: 2, CANCELADA: 1 },
      prioridade_aberta: { URGENTE: 0, ALTA: 2, MEDIA: 0, BAIXA: 0 },
      mais_antiga_aberta: { URGENTE: null, ALTA: '2026-09-16T08:00:00Z', MEDIA: null, BAIXA: null },
      total: 4,
      filtros_aplicados: { categoria: null, prioridade: 'ALTA' },
    });
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({ data: [], total: 0, last_page: 1 });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    // A tira de etapas continua mostrando as encerradas (Concluídas/Canceladas) mesmo na
    // página principal, que agora só lista solicitações em aberto — "Por etapa" é um resumo
    // do funil completo, não da lista abaixo.
    const concluidas = await screen.findByRole('button', { name: /2 solicitações concluídas/ });
    expect(concluidas).toHaveTextContent('Concluídas');
    expect(concluidas).toHaveAttribute('aria-pressed', 'false');
    const canceladas = screen.getByRole('button', { name: /1 solicitação cancelada/ });
    expect(canceladas).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 solicitação recebida/ })).toHaveAttribute('aria-pressed', 'false');

    // Clicar numa etapa encerrada abre o drill-down normalmente, igual a uma etapa em aberto.
    fireEvent.click(concluidas);
    expect(await screen.findByRole('heading', { name: 'Concluídas' })).toBeInTheDocument();
    await waitFor(() => {
      expect(solicitacoesApi.listar).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CONCLUIDA', per_page: 50 })
      );
    });
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

    expect(await screen.findByText(/todas as solicitações/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'EXAME' } });

    await waitFor(() => {
      expect(solicitacoesApi.resumo).toHaveBeenCalledWith(
        expect.objectContaining({ categoria: 'EXAME' })
      );
    });
    expect(await screen.findByText(/categoria Exame/)).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /solicitação urgente em aberto/ }));
    await waitFor(() => {
      expect(solicitacoesApi.listar).toHaveBeenCalledWith(
        expect.objectContaining({ prioridade: 'URGENTE', status_grupo: 'aberto', categoria: 'EXAME' })
      );
    });
  });

  it('mostra a próxima solicitação da fila no cartão de destaque, com atalho para atender', async () => {
    vi.mocked(solicitacoesApi.listar).mockImplementation(async (filtros) => {
      if (filtros?.per_page === 1) {
        return { data: [{ ...solicitacaoBase, prioridade: 'URGENTE' }], total: 1, last_page: 1 };
      }
      return { data: [], total: 0, last_page: 1 };
    });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Próxima solicitação por prioridade')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir solicitação/ })).toHaveAttribute('href', '/solicitacoes/1');
    expect(screen.queryByText(/Fila vazia/)).not.toBeInTheDocument();
  });

  it('mostra a data agendada (não "esperando") quando a próxima solicitação já está AGENDADA', async () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(solicitacoesApi.listar).mockImplementation(async (filtros) => {
      if (filtros?.per_page === 1) {
        return {
          data: [{
            ...solicitacaoBase,
            prioridade: 'URGENTE',
            status: 'AGENDADA',
            agendado_para: ontem,
            agendamento_ativo: {
              id: 1,
              modalidade: 'HORARIO',
              data_agendada: ontem.slice(0, 10),
              hora_agendada: '08:00',
              turno: 'MANHA',
              status: 'AGENDADO',
              falta_registrada_em: null,
              falta_corrigida_em: null,
              resultado_em: null,
            },
          }],
          total: 1,
          last_page: 1,
        };
      }
      return { data: [], total: 0, last_page: 1 };
    });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Próxima solicitação por prioridade')).toBeInTheDocument();
    // Já tem agendamento: a frase de "esperando há N dias" (tempo desde a criação) some,
    // porque a solicitação não está mais só esperando — já foi marcada.
    expect(screen.queryByText(/esperando há/)).not.toBeInTheDocument();
    expect(screen.getByText(/agendado para/)).toBeInTheDocument();
    // O horário agendado já passou (mock é de ontem): sinaliza atraso, em vez de sugerir
    // que a solicitação está normalmente "em espera".
    expect(screen.getByText(/em atraso/)).toBeInTheDocument();
  });

  it('mostra mensagem de fila vazia quando não há solicitações em aberto', async () => {
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({ data: [], total: 0, last_page: 1 });

    render(
      <MemoryRouter>
        <SolicitacoesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Fila vazia/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Abrir solicitação/ })).not.toBeInTheDocument();
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
