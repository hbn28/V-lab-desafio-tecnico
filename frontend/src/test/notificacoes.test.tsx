import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { NotificacoesPanel } from '../features/notificacoes/components/NotificacoesPanel';
import { notificacoesApi } from '../features/notificacoes/api/client';

vi.mock('../features/notificacoes/api/client', () => ({
  notificacoesApi: { listar: vi.fn(), marcarLida: vi.fn() },
}));

test('painel mostra somente metadados da mudança e permite marcar leitura', async () => {
  vi.mocked(notificacoesApi.listar).mockResolvedValue({
    unread_count: 1,
    meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
    data: [{ id: 7, solicitacao_id: 3, protocolo: 'SOL-2025-0003', status_anterior: 'RECEBIDA', status_novo: 'EM_ANALISE', created_at: '2026-09-22T12:00:00Z', read_at: null }],
  });
  vi.mocked(notificacoesApi.marcarLida).mockResolvedValue({
    id: 7, solicitacao_id: 3, protocolo: 'SOL-2025-0003', status_anterior: 'RECEBIDA', status_novo: 'EM_ANALISE', created_at: '2026-09-22T12:00:00Z', read_at: '2026-09-22T12:01:00Z',
  });

  render(<MemoryRouter><NotificacoesPanel /></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: /notificações/i }));
  expect(await screen.findByRole('link', { name: /SOL-2025-0003/i })).toHaveAttribute('href', '/solicitacoes/3');
  expect(screen.getByText(/1 notificação não lida/i)).toBeInTheDocument();
  expect(screen.queryByText(/CPF|paciente/i)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /marcar como lida/i }));
  expect(notificacoesApi.marcarLida).toHaveBeenCalledWith(7);
});

test('carrega páginas adicionais de notificações antigas', async () => {
  vi.mocked(notificacoesApi.listar)
    .mockResolvedValueOnce({
      unread_count: 21,
      meta: { current_page: 1, last_page: 2, per_page: 20, total: 21 },
      data: [{ id: 20, solicitacao_id: 3, protocolo: 'SOL-2026-0020', status_anterior: 'RECEBIDA', status_novo: 'EM_ANALISE', created_at: '2026-09-22T12:00:00Z', read_at: null }],
    })
    .mockResolvedValueOnce({
      unread_count: 21,
      meta: { current_page: 2, last_page: 2, per_page: 20, total: 21 },
      data: [{ id: 1, solicitacao_id: 3, protocolo: 'SOL-2026-0001', status_anterior: 'RECEBIDA', status_novo: 'EM_ANALISE', created_at: '2026-09-01T12:00:00Z', read_at: null }],
    });

  render(<MemoryRouter><NotificacoesPanel /></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: /notificações/i }));
  expect(await screen.findByRole('link', { name: /SOL-2026-0020/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Carregar mais notificações' }));
  expect(await screen.findByRole('link', { name: /SOL-2026-0001/i })).toBeInTheDocument();
  expect(notificacoesApi.listar).toHaveBeenLastCalledWith(2);
});

test('Escape fecha o painel e devolve foco ao acionador', async () => {
  vi.mocked(notificacoesApi.listar).mockResolvedValue({
    unread_count: 0,
    meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    data: [],
  });
  const user = userEvent.setup();
  render(<MemoryRouter><NotificacoesPanel /></MemoryRouter>);
  const trigger = screen.getByRole('button', { name: /notificações/i });
  await user.click(trigger);
  expect(await screen.findByText('Nenhuma notificação no momento.')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('region', { name: 'Notificações operacionais' })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
