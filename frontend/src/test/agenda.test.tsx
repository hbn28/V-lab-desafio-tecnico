import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { SolicitacoesPage } from '../features/solicitacoes/pages/SolicitacoesPage';
import { HistoricoSolicitacoesPage } from '../features/solicitacoes/pages/HistoricoSolicitacoesPage';
import { solicitacoesApi } from '../features/solicitacoes/api/client';
import { dataHojeNoFuso } from '../features/solicitacoes/config/agendamento';
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

const solicitacaoBase: Solicitacao = {
  id: 1,
  protocolo: 'SOL-2026-0001',
  nome_solicitante: 'Maria da Silva',
  cpf_solicitante: '123.456.789-00',
  data_nascimento: '1985-06-15',
  categoria: 'CONSULTA',
  prioridade: 'MEDIA',
  status: 'RECEBIDA',
  descricao: 'Consulta fictícia.',
  justificativa_prioridade: null,
  agendado_para: null,
  data_criacao: '2026-09-17T12:00:00Z',
  data_atualizacao: '2026-09-17T12:00:00Z',
};

const resumoMock = {
  status: { RECEBIDA: 1, EM_ANALISE: 1, AGENDADA: 0, CONCLUIDA: 1, CANCELADA: 0 },
  prioridade_aberta: { URGENTE: 1, ALTA: 1, MEDIA: 0, BAIXA: 0 },
  mais_antiga_aberta: { URGENTE: '2026-09-17T08:00:00Z', ALTA: '2026-09-17T09:00:00Z', MEDIA: null, BAIXA: null },
  total: 3,
  filtros_aplicados: { categoria: null, prioridade: null },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(solicitacoesApi.resumo).mockResolvedValue(resumoMock);
  vi.mocked(solicitacoesApi.listar).mockResolvedValue({ data: [], total: 0, last_page: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPagina(entrada: string) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/" element={<SolicitacoesPage />} />
        <Route path="/solicitacoes/historico" element={<HistoricoSolicitacoesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function NavegacaoDoTeste() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>Voltar no navegador</button>
      <button type="button" onClick={() => navigate(1)}>Avançar no navegador</button>
    </>
  );
}

function renderPaginaComHistorico(entrada: string) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <NavegacaoDoTeste />
      <Routes>
        <Route path="/" element={<SolicitacoesPage />} />
        <Route path="/solicitacoes/historico" element={<HistoricoSolicitacoesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Agenda diária', () => {
  it('abre agenda pelo dia da URL e consulta somente AGENDADA', async () => {
    renderPagina('/?visao=agenda&data=2026-09-25');
    expect(await screen.findByRole('heading', { name: 'Agenda do dia' })).toBeInTheDocument();
    expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({
      status: 'AGENDADA', data_agendada: '2026-09-25', page: 1, per_page: 10,
    }));
  });

  it('mantém a data selecionada depois da virada do relógio', async () => {
    vi.setSystemTime('2026-09-25T23:59:00-03:00');
    renderPagina('/?visao=agenda&data=2026-09-25');
    await screen.findByDisplayValue('2026-09-25');
    vi.setSystemTime('2026-09-26T00:01:00-03:00');
    expect(screen.getByLabelText('Data da agenda')).toHaveValue('2026-09-25');
  });

  it('trocar o dia volta à página um e normaliza data inválida', async () => {
    vi.mocked(solicitacoesApi.listar).mockImplementation(async filtros =>
      filtros?.per_page === 1
        ? { data: [], total: 0, last_page: 1 }
        : { data: [{ ...solicitacaoBase, status: 'AGENDADA', agendado_para: '2026-09-25T12:00:00Z' }], total: 20, last_page: 2 }
    );
    renderPagina('/?visao=agenda&data=invalida');
    const campo = await screen.findByLabelText('Data da agenda');
    expect(campo).toHaveValue(dataHojeNoFuso());
    await userEvent.click(await screen.findByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(solicitacoesApi.listar).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    fireEvent.change(campo, { target: { value: '2026-09-27' } });
    await waitFor(() => expect(solicitacoesApi.listar).toHaveBeenLastCalledWith(expect.objectContaining({
      data_agendada: '2026-09-27', page: 1,
    })));
  });

  it('renderiza erro recuperável e depois o estado vazio', async () => {
    vi.mocked(solicitacoesApi.listar)
      .mockRejectedValueOnce(new Error('Falha de rede'))
      .mockResolvedValue({ data: [], total: 0, last_page: 1 });
    renderPagina('/?visao=agenda&data=2026-09-25');
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Nenhum atendimento agendado para este dia')).toBeInTheDocument();
  });

  it('mantém solicitações diferentes no mesmo horário', async () => {
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({
      data: [
        { ...solicitacaoBase, id: 1, protocolo: 'SOL-2026-0001', status: 'AGENDADA', agendado_para: '2026-09-25T12:00:00Z' },
        { ...solicitacaoBase, id: 2, protocolo: 'SOL-2026-0002', status: 'AGENDADA', agendado_para: '2026-09-25T12:00:00Z' },
      ], total: 2, last_page: 1,
    });
    renderPagina('/?visao=agenda&data=2026-09-25');
    expect(await screen.findByText('SOL-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('SOL-2026-0002')).toBeInTheDocument();
    expect(screen.getAllByText(/09:00/)).toHaveLength(2);
  });

  it('não mostra o painel global nem o seletor de status na agenda', async () => {
    renderPagina('/?visao=agenda&data=2026-09-25');
    await screen.findByRole('heading', { name: 'Agenda do dia' });
    expect(screen.queryByRole('heading', { name: 'Prioridades em aberto' })).not.toBeInTheDocument();
    expect(screen.queryByText('Próxima solicitação por prioridade')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
  });

  it('Histórico encerrado é uma página própria, sem o destaque operacional da fila', async () => {
    renderPagina('/');
    expect(await screen.findByText('Próxima solicitação por prioridade')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Histórico encerrado' }));
    expect(await screen.findByRole('heading', { name: 'Histórico encerrado' })).toBeInTheDocument();
    expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({ status_grupo: 'encerrado' }));
    // A página de histórico não repete "Prioridades em aberto" nem "Próxima solicitação por
    // prioridade" — são cartões sobre a fila em aberto, não sobre o que já foi encerrado.
    expect(screen.queryByText('Próxima solicitação por prioridade')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Prioridades em aberto' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fila atual' }));
    expect(await screen.findByText('Próxima solicitação por prioridade')).toBeInTheDocument();
    expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({ status_grupo: 'aberto' }));
  });

  it('a visão Agenda do painel usa o dia atual no fuso operacional', async () => {
    renderPagina('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Agenda' }));
    expect(await screen.findByLabelText('Data da agenda')).toHaveValue(dataHojeNoFuso());
    expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({
      status: 'AGENDADA', data_agendada: dataHojeNoFuso(),
    }));
  });

  it('mostra o turno (sem horário exato) na agenda do dia', async () => {
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({
      data: [
        {
          ...solicitacaoBase,
          id: 3,
          protocolo: 'SOL-2026-0003',
          status: 'AGENDADA',
          agendado_para: null,
          agendamento_ativo: {
            id: 1,
            modalidade: 'TURNO',
            data_agendada: '2026-09-25',
            hora_agendada: null,
            turno: 'TARDE',
            status: 'AGENDADO',
            falta_registrada_em: null,
            falta_corrigida_em: null,
            resultado_em: null,
          },
        },
      ],
      total: 1,
      last_page: 1,
    });
    renderPagina('/?visao=agenda&data=2026-09-25');
    expect(await screen.findByText('SOL-2026-0003')).toBeInTheDocument();
    expect(screen.getByText('Tarde')).toBeInTheDocument();
  });

  it('sincroniza a visão com a URL ao voltar e avançar no navegador', async () => {
    renderPaginaComHistorico('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Agenda' }));
    expect(await screen.findByRole('heading', { name: 'Agenda do dia' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Histórico encerrado' }));
    expect(await screen.findByRole('heading', { name: 'Histórico encerrado' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Voltar no navegador' }));
    expect(await screen.findByRole('heading', { name: 'Agenda do dia' })).toBeInTheDocument();
    expect(screen.getByLabelText('Data da agenda')).toHaveValue(dataHojeNoFuso());

    await userEvent.click(screen.getByRole('button', { name: 'Avançar no navegador' }));
    expect(await screen.findByRole('heading', { name: 'Histórico encerrado' })).toBeInTheDocument();
  });
});
