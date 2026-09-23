import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SolicitacoesPage } from '../features/solicitacoes/pages/SolicitacoesPage';
import { solicitacoesApi } from '../features/solicitacoes/api/client';
import { ContatoFaltaDialog } from '../features/solicitacoes/components/ContatoFaltaDialog';
import { FaltaCard } from '../features/solicitacoes/components/FaltaCard';
import type { FaltaListItem } from '../features/solicitacoes/types';

it('mostra falha de contato dentro do diálogo', () => {
  render(<ContatoFaltaDialog error="Falha ao registrar contato" onSalvar={vi.fn()} onCancelar={vi.fn()} />);
  expect(within(screen.getByRole('dialog', { name: 'Registrar contato' })).getByRole('alert')).toHaveTextContent('Falha ao registrar contato');
});

it('mantém a falta histórica sem oferecer novo reagendamento e formata o turno sem vírgula', () => {
  const falta: FaltaListItem = {
    id: 31, modalidade: 'TURNO', data_agendada: '2026-09-22', hora_agendada: null,
    turno: 'TARDE', status: 'FALTA', falta_registrada_em: '2026-09-23T12:00:00Z',
    falta_corrigida_em: null, resultado_em: '2026-09-23T13:00:00Z',
    solicitacao: { id: 11, protocolo: 'SOL-2026-0001', nome_solicitante: 'Pessoa Fictícia', status: 'AGENDADA' },
  };
  render(<FaltaCard falta={falta} onRegistrarContato={vi.fn()} onReagendar={vi.fn()} />);
  expect(screen.getByText('22/09/2026 · Tarde')).toBeInTheDocument();
  expect(screen.getByText('Reagendada')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reagendar' })).not.toBeInTheDocument();
});

it('reconhece falta antiga reagendada quando existe novo agendamento ativo', () => {
  const falta: FaltaListItem = {
    id: 31, modalidade: 'HORARIO', data_agendada: '2026-09-22', hora_agendada: '09:00',
    turno: 'MANHA', status: 'FALTA', falta_registrada_em: '2026-09-23T12:00:00Z',
    falta_corrigida_em: null, resultado_em: null,
    solicitacao: {
      id: 11, protocolo: 'SOL-2026-0001', nome_solicitante: 'Pessoa Fictícia', status: 'AGENDADA',
      agendamento_ativo: { id: 32, modalidade: 'TURNO', data_agendada: '2026-09-30', hora_agendada: null,
        turno: 'TARDE', status: 'AGENDADO', falta_registrada_em: null, falta_corrigida_em: null, resultado_em: null },
    },
  };
  render(<FaltaCard falta={falta} onRegistrarContato={vi.fn()} onReagendar={vi.fn()} />);
  expect(screen.getByText('Reagendada')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reagendar' })).not.toBeInTheDocument();
});

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
    listarFila: vi.fn(),
    listarFaltas: vi.fn(),
    registrarFalta: vi.fn(),
    registrarContato: vi.fn(),
    reagendarAposFalta: vi.fn(),
  },
}));

const resumoMock = {
  status: { RECEBIDA: 0, EM_ANALISE: 0, AGENDADA: 0, CONCLUIDA: 0, CANCELADA: 0 },
  prioridade_aberta: { URGENTE: 0, ALTA: 0, MEDIA: 0, BAIXA: 0 },
  mais_antiga_aberta: { URGENTE: null, ALTA: null, MEDIA: null, BAIXA: null },
  total: 0,
  filtros_aplicados: { categoria: null, prioridade: null },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(solicitacoesApi.listar).mockResolvedValue({ data: [], total: 0, last_page: 1 });
  vi.mocked(solicitacoesApi.resumo).mockResolvedValue(resumoMock);
});

describe('Aba de Faltas', () => {
  it('filtra a fila de faltas pelo resultado da última tentativa', async () => {
    vi.mocked(solicitacoesApi.listarFaltas).mockResolvedValue({
      data: [], meta: { total: 0, per_page: 10, current_page: 1, last_page: 1 },
      links: { first: null, last: null, next: null, prev: null },
    });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/?visao=faltas']}><Routes><Route path="/" element={<SolicitacoesPage />} /></Routes></MemoryRouter>);
    await user.selectOptions(await screen.findByLabelText('Resultado do contato'), 'SEM_RESPOSTA');
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(solicitacoesApi.listarFaltas).toHaveBeenLastCalledWith(expect.objectContaining({ resultado_contato: 'SEM_RESPOSTA', page: 1 }));
  });

  it('abre aba Faltas e registra contato com quatro opcoes fechadas', async () => {
    vi.mocked(solicitacoesApi.listarFaltas).mockResolvedValue({
      data: [{
        id: 10,
        modalidade: 'TURNO',
        data_agendada: '2026-09-25',
        hora_agendada: null,
        turno: 'MANHA',
        status: 'FALTA',
        falta_registrada_em: '2026-09-25T15:00:00Z',
        falta_corrigida_em: null,
        resultado_em: null,
        solicitacao: {
          id: 1,
          protocolo: 'SOL-2026-0001',
          nome_solicitante: 'Maria da Silva',
          paciente: { id: 1, nome: 'Maria da Silva', celular_mascarado: '(81) *****-0000' },
        },
        ultima_tentativa_contato: null,
      }],
      meta: { total: 1, per_page: 10, current_page: 1, last_page: 1 },
      links: { first: null, last: null, next: null, prev: null },
    });

    render(<MemoryRouter initialEntries={['/?visao=faltas']}><Routes><Route path="/" element={<SolicitacoesPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Faltas' })).toBeInTheDocument();
    expect(screen.getByText('(81) *****-0000')).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Registrar contato' });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Registrar contato' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.parentElement).toHaveClass('dialog-backdrop');
    expect(screen.getByRole('radio', { name: 'Sem resposta' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Recado deixado' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Confirmou retorno' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Número inválido' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/observ/i)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sem resposta' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Registrar contato' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('abre o reagendamento em camada de diálogo sobre a lista', async () => {
    vi.mocked(solicitacoesApi.listarFaltas).mockResolvedValue({
      data: [{
        id: 11,
        modalidade: 'TURNO',
        data_agendada: '2026-09-25',
        hora_agendada: null,
        turno: 'MANHA',
        status: 'FALTA',
        falta_registrada_em: '2026-09-25T15:00:00Z',
        falta_corrigida_em: null,
        resultado_em: null,
        solicitacao: { id: 2, protocolo: 'SOL-2026-0002', nome_solicitante: 'Joana Teste' },
        ultima_tentativa_contato: null,
      }],
      meta: { total: 1, per_page: 10, current_page: 1, last_page: 1 },
      links: { first: null, last: null, next: null, prev: null },
    });

    render(<MemoryRouter initialEntries={['/?visao=faltas']}><Routes><Route path="/" element={<SolicitacoesPage />} /></Routes></MemoryRouter>);
    const trigger = await screen.findByRole('button', { name: 'Reagendar' });
    await userEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Reagendar após falta' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.parentElement).toHaveClass('dialog-backdrop');
    expect(screen.getByRole('button', { name: 'Confirmar novo agendamento' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Reagendar após falta' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('mostra erro se outro operador já reagendou a falta', async () => {
    vi.mocked(solicitacoesApi.listarFaltas).mockResolvedValue({
      data: [{
        id: 11, modalidade: 'TURNO', data_agendada: '2026-09-25', hora_agendada: null,
        turno: 'MANHA', status: 'FALTA', falta_registrada_em: '2026-09-25T15:00:00Z',
        falta_corrigida_em: null, resultado_em: null,
        solicitacao: { id: 2, protocolo: 'SOL-2026-0002', nome_solicitante: 'Joana Teste' },
        ultima_tentativa_contato: null,
      }],
      meta: { total: 1, per_page: 10, current_page: 1, last_page: 1 },
      links: { first: null, last: null, next: null, prev: null },
    });
    vi.mocked(solicitacoesApi.reagendarAposFalta).mockRejectedValue(Object.assign(new Error('Este agendamento já foi reagendado.'), { status: 409, errors: {} }));

    render(<MemoryRouter initialEntries={['/?visao=faltas']}><Routes><Route path="/" element={<SolicitacoesPage />} /></Routes></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: 'Reagendar' }));
    await userEvent.type(screen.getByLabelText('Data do atendimento'), '2026-09-30');
    await userEvent.click(screen.getByRole('radio', { name: 'Turno' }));
    await userEvent.selectOptions(screen.getByLabelText('Turno do atendimento'), 'TARDE');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar novo agendamento' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este agendamento já foi reagendado.');
    expect(screen.getByRole('dialog', { name: 'Reagendar após falta' })).toBeInTheDocument();
  });
  it('mostra texto de vazio quando nao ha faltas pendentes', async () => {
    vi.mocked(solicitacoesApi.listarFaltas).mockResolvedValue({
      data: [],
      meta: { total: 0, per_page: 10, current_page: 1, last_page: 1 },
      links: { first: null, last: null, next: null, prev: null },
    });

    render(<MemoryRouter initialEntries={['/?visao=faltas']}><Routes><Route path="/" element={<SolicitacoesPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Nenhuma falta pendente')).toBeInTheDocument();
  });
});
