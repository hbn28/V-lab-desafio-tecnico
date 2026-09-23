import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { SolicitacoesPage } from '../features/solicitacoes/pages/SolicitacoesPage';
import { solicitacoesApi } from '../features/solicitacoes/api/client';
import type { Solicitacao } from '../features/solicitacoes/types';

vi.mock('../features/solicitacoes/api/client', () => ({
  solicitacoesApi: {
    criar: vi.fn(), listar: vi.fn(), listarFaltas: vi.fn(), resumo: vi.fn(), buscar: vi.fn(),
    atualizarStatus: vi.fn(), reagendar: vi.fn(), atualizar: vi.fn(), apagar: vi.fn(),
  },
}));

const solicitacaoBase: Solicitacao = {
  id: 1, protocolo: 'SOL-2026-0001', nome_solicitante: 'Maria da Silva', cpf_solicitante: '123.456.789-00',
  data_nascimento: '1985-06-15', categoria: 'CONSULTA', prioridade: 'MEDIA', status: 'AGENDADA',
  descricao: 'Solicitação fictícia.', justificativa_prioridade: null, agendado_para: '2026-09-25T12:00:00Z',
  data_criacao: '2026-09-17T12:00:00Z', data_atualizacao: '2026-09-17T12:00:00Z',
};

const resumoMock = {
  status: { RECEBIDA: 1, EM_ANALISE: 1, AGENDADA: 0, CONCLUIDA: 1, CANCELADA: 0 },
  prioridade_aberta: { URGENTE: 1, ALTA: 1, MEDIA: 0, BAIXA: 0 },
  mais_antiga_aberta: { URGENTE: '2026-09-17T08:00:00Z', ALTA: '2026-09-17T09:00:00Z', MEDIA: null, BAIXA: null },
  total: 3, filtros_aplicados: { categoria: null, prioridade: null },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(solicitacoesApi.resumo).mockResolvedValue(resumoMock);
  vi.mocked(solicitacoesApi.listar).mockResolvedValue({ data: [], total: 0, last_page: 1 });
});
afterEach(() => vi.useRealTimers());

function renderPagina(entrada: string, navegador = false) {
  function AcoesNavegacao() {
    const navigate = useNavigate();
    return <><button onClick={() => navigate(-1)}>Voltar</button><button onClick={() => navigate(1)}>Avançar</button></>;
  }
  return render(<MemoryRouter initialEntries={[entrada]}>
    {navegador && <AcoesNavegacao />}
    <Routes><Route path="/" element={<SolicitacoesPage />} /></Routes>
  </MemoryRouter>);
}

describe('Solicitações agendadas', () => {
  it('abre uma semana com sete filas separadas e consulta horário/turno em cada dia', async () => {
    renderPagina('/?visao=agenda&data=2026-09-25');
    expect(await screen.findByRole('heading', { name: 'Solicitações agendadas' })).toBeInTheDocument();
    await waitFor(() => expect(solicitacoesApi.listar).toHaveBeenCalledTimes(7));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
    expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({
      status: 'AGENDADA', data_agendada: '2026-09-25', page: 1, per_page: 10,
    }));
    expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({ data_agendada: '2026-10-01' }));
  });

  it('navega semanas consecutivas de sete dias e preserva o critério comum', async () => {
    renderPagina('/?visao=agenda&inicio=2026-09-25&ordenar_por=prioridade&q=Maria');
    await screen.findByRole('heading', { name: 'Solicitações agendadas' });
    await userEvent.click(screen.getByRole('button', { name: 'Próxima semana' }));
    await waitFor(() => expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({
      data_agendada: '2026-10-02', ordenar_por: 'prioridade', q: 'Maria',
    })));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
  });

  it('mantém paginação independente por dia', async () => {
    vi.mocked(solicitacoesApi.listar).mockResolvedValue({ data: [solicitacaoBase], total: 20, last_page: 2 });
    renderPagina('/?visao=agenda&inicio=2026-09-25');
    await screen.findAllByText('SOL-2026-0001');
    const navegacaoDia = screen.getByRole('navigation', { name: /paginação de sexta-feira, 25 de setembro/i });
    await userEvent.click(within(navegacaoDia).getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({
      data_agendada: '2026-09-25', page: 2,
    })));
    expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({ data_agendada: '2026-09-26', page: 1 }));
  });

  it('mantém modalidade TURNO visível e informa vazio nos outros dias', async () => {
    vi.mocked(solicitacoesApi.listar).mockImplementation(async filtros => filtros?.data_agendada === '2026-09-25'
      ? { data: [{ ...solicitacaoBase, agendado_para: null, agendamento_ativo: {
          id: 1, modalidade: 'TURNO', data_agendada: '2026-09-25', hora_agendada: null, turno: 'TARDE',
          status: 'AGENDADO', falta_registrada_em: null, falta_corrigida_em: null, resultado_em: null,
        } }], total: 1, last_page: 1 }
      : { data: [], total: 0, last_page: 1 });
    renderPagina('/?visao=agenda&inicio=2026-09-25');
    expect(await screen.findByText('Tarde')).toBeInTheDocument();
    expect(await screen.findAllByText('Nenhuma solicitação agendada.')).toHaveLength(6);
  });

  it('isola falha de um dia e oferece nova tentativa', async () => {
    vi.mocked(solicitacoesApi.listar)
      .mockRejectedValueOnce(new Error('Falha de rede'))
      .mockResolvedValue({ data: [], total: 0, last_page: 1 });
    renderPagina('/?visao=agenda&inicio=2026-09-25');
    expect(await screen.findByText('Falha de rede')).toBeInTheDocument();
    expect(await screen.findAllByText('Nenhuma solicitação agendada.')).toHaveLength(6);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(solicitacoesApi.listar).toHaveBeenCalledTimes(14));
  });

  it('sincroniza a visão com voltar e avançar no navegador', async () => {
    renderPagina('/?visao=agenda&inicio=2026-09-25', true);
    await screen.findByRole('heading', { name: 'Solicitações agendadas' });
    await userEvent.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(await screen.findByRole('heading', { name: 'Histórico' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByRole('heading', { name: 'Solicitações agendadas' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(await screen.findByRole('heading', { name: 'Histórico' })).toBeInTheDocument();
  });
});
