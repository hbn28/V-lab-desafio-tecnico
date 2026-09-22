import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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

function renderDetalhe(solicitacao: Solicitacao) {
  vi.mocked(solicitacoesApi.buscar).mockResolvedValue(solicitacao);
  return render(
    <MemoryRouter initialEntries={[`/solicitacoes/${solicitacao.id}`]}>
      <Routes><Route path="/solicitacoes/:id" element={<SolicitacaoDetailPage />} /></Routes>
    </MemoryRouter>
  );
}

async function abrirEPreencherAgendamento(data: string, hora: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'Agendar atendimento' }));
  fireEvent.change(screen.getByLabelText('Data do atendimento'), { target: { value: data } });
  fireEvent.change(screen.getByLabelText('Horário do atendimento'), { target: { value: hora } });
}

describe('Agendamento no detalhe da solicitação', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('agenda EM_ANALISE com data e hora obrigatórias', async () => {
    vi.mocked(solicitacoesApi.atualizarStatus).mockResolvedValue({
      ...solicitacaoBase, status: 'AGENDADA', agendado_para: '2026-09-25T17:30:00Z',
    });
    renderDetalhe({ ...solicitacaoBase, status: 'EM_ANALISE' });

    expect(screen.queryByRole('button', { name: /Mover para Agendada/ })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Agendar atendimento' }));
    await userEvent.type(screen.getByLabelText('Data do atendimento'), '2026-09-25');
    await userEvent.type(screen.getByLabelText('Horário do atendimento'), '14:30');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));

    expect(solicitacoesApi.atualizarStatus).toHaveBeenCalledWith('1', {
      status: 'AGENDADA', data_agendada: '2026-09-25', hora_agendada: '14:30',
    });
    expect(await screen.findByText('Agendamento confirmado.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Agendamento confirmado');
  });

  it('preenche e salva o reagendamento de AGENDADA', async () => {
    vi.mocked(solicitacoesApi.reagendar).mockResolvedValue({
      ...solicitacaoBase, status: 'AGENDADA', agendado_para: '2026-09-28T12:00:00Z',
    });
    renderDetalhe({ ...solicitacaoBase, status: 'AGENDADA', agendado_para: '2026-09-25T17:30:00Z' });

    expect((await screen.findAllByText(/25\/09\/2026/)).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Alterar agendamento' }));
    expect(screen.getByLabelText('Horário do atendimento')).toHaveValue('14:30');
    expect(screen.getByLabelText('Data do atendimento')).toHaveValue('2026-09-25');

    fireEvent.change(screen.getByLabelText('Data do atendimento'), { target: { value: '2026-09-28' } });
    fireEvent.change(screen.getByLabelText('Horário do atendimento'), { target: { value: '09:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar novo horário' }));

    expect(solicitacoesApi.reagendar).toHaveBeenCalledWith('1', { data_agendada: '2026-09-28', hora_agendada: '09:00' });
    expect(await screen.findByText('Agendamento atualizado.')).toBeInTheDocument();
  });

  it('mostra o horário histórico em estado terminal sem oferecer reagendamento', async () => {
    renderDetalhe({ ...solicitacaoBase, status: 'CONCLUIDA', agendado_para: '2026-09-25T17:30:00Z' });
    expect((await screen.findAllByText(/25\/09\/2026/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Alterar agendamento' })).not.toBeInTheDocument();
  });

  it('preserva valores no 422 e associa o erro ao campo', async () => {
    vi.mocked(solicitacoesApi.atualizarStatus).mockRejectedValue(Object.assign(new Error('Dados inválidos'), {
      status: 422, errors: { hora_agendada: ['O horário deve ser futuro.'] },
    }));
    renderDetalhe({ ...solicitacaoBase, status: 'EM_ANALISE' });
    await abrirEPreencherAgendamento('2026-09-25', '14:30');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));

    expect((await screen.findAllByText('O horário deve ser futuro.')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Horário do atendimento')).toHaveValue('14:30');
    expect(screen.getByLabelText('Horário do atendimento')).toHaveAttribute('aria-invalid', 'true');
  });

  it('recarrega e explica conflito 409 sem apagar o formulário', async () => {
    vi.mocked(solicitacoesApi.atualizarStatus).mockRejectedValue(Object.assign(new Error('Conflito'), {
      status: 409, errors: {},
    }));
    renderDetalhe({ ...solicitacaoBase, status: 'EM_ANALISE' });
    await abrirEPreencherAgendamento('2026-09-25', '14:30');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));

    expect(await screen.findByText(/mudou enquanto você editava/i)).toBeInTheDocument();
    expect(solicitacoesApi.buscar).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Data do atendimento')).toHaveValue('2026-09-25');
  });

  it('cancelar edição restaura o foco e mantém concluir e cancelar separados', async () => {
    renderDetalhe({ ...solicitacaoBase, status: 'AGENDADA', agendado_para: '2026-09-25T17:30:00Z' });
    const abrir = await screen.findByRole('button', { name: 'Alterar agendamento' });
    await userEvent.click(abrir);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar edição' }));
    expect(abrir).toHaveFocus();
    expect(screen.getByRole('button', { name: /Mover para Concluída/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mover para Cancelada/ })).toBeInTheDocument();
  });
});
