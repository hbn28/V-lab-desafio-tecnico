import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SolicitacoesPage } from '../features/solicitacoes/pages/SolicitacoesPage';
import { solicitacoesApi } from '../features/solicitacoes/api/client';
import type { FaltaListItem } from '../features/solicitacoes/types';

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

const faltaBase: FaltaListItem = {
  id: 10,
  modalidade: 'TURNO',
  data_agendada: '2026-09-25',
  hora_agendada: null,
  turno: 'MANHA',
  status: 'FALTA',
  falta_registrada_em: '2026-09-25T15:00:00Z',
  falta_corrigida_em: null,
  resultado_em: null,
  solicitacao: { id: 1, protocolo: 'SOL-2026-0001', nome_solicitante: 'Maria da Silva', paciente: null },
  ultima_tentativa_contato: null,
};

function renderFaltas() {
  return render(<MemoryRouter initialEntries={['/?visao=faltas']}><Routes><Route path="/" element={<SolicitacoesPage />} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(solicitacoesApi.listar).mockResolvedValue({ data: [], total: 0, last_page: 1 });
  vi.mocked(solicitacoesApi.resumo).mockResolvedValue(resumoMock);
});

describe('Aba de Faltas', () => {
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
    await userEvent.click(screen.getByRole('button', { name: 'Registrar contato' }));
    expect(screen.getByRole('radio', { name: 'Sem resposta' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Recado deixado' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Confirmou retorno' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Número inválido' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/observ/i)).not.toBeInTheDocument();
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

  it('mostra data e horário locais da falta sem converter fuso', async () => {
    vi.mocked(solicitacoesApi.listarFaltas).mockResolvedValue({
      data: [{ ...faltaBase, id: 11, modalidade: 'HORARIO', hora_agendada: '10:00', turno: 'MANHA' }],
      meta: { total: 1, per_page: 10, current_page: 1, last_page: 1 },
      links: { first: null, last: null, next: null, prev: null },
    });

    renderFaltas();
    expect(await screen.findByText('Faltou ao atendimento de 25/09/2026 às 10:00')).toBeInTheDocument();
  });

  it('exibe o erro quando o reagendamento após falta é recusado com 409', async () => {
    vi.mocked(solicitacoesApi.listarFaltas).mockResolvedValue({
      data: [faltaBase],
      meta: { total: 1, per_page: 10, current_page: 1, last_page: 1 },
      links: { first: null, last: null, next: null, prev: null },
    });
    vi.mocked(solicitacoesApi.reagendarAposFalta).mockRejectedValue(
      Object.assign(new Error('Já existe um agendamento ativo para esta solicitação.'), { status: 409, errors: {} })
    );

    renderFaltas();
    await userEvent.click(await screen.findByRole('button', { name: 'Reagendar' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Turno' }));
    fireEvent.change(screen.getByLabelText('Data do atendimento'), { target: { value: '2026-09-30' } });
    await userEvent.selectOptions(screen.getByLabelText('Turno do atendimento'), 'TARDE');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar novo agendamento' }));

    expect(solicitacoesApi.reagendarAposFalta).toHaveBeenCalledWith(10, { data_agendada: '2026-09-30', turno: 'TARDE' });
    expect(await screen.findByText('Já existe um agendamento ativo para esta solicitação.')).toBeInTheDocument();
  });
});
