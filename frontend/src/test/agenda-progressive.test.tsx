import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { solicitacoesApi } from '../features/solicitacoes/api/client';
import { useAgendaSemanal } from '../features/solicitacoes/hooks/useAgendaSemanal';

vi.mock('../features/solicitacoes/api/client', () => ({ solicitacoesApi: { listar: vi.fn() } }));

it('exibe um dia resolvido mesmo com outro dia ainda pendente', async () => {
  let resolveFirst!: (value: { data: []; total: number; last_page: number }) => void;
  const pending = new Promise<{ data: []; total: number; last_page: number }>(resolve => { resolveFirst = resolve; });
  vi.mocked(solicitacoesApi.listar).mockImplementation(params => params?.data_agendada === '2026-09-25'
    ? pending
    : Promise.resolve({ data: [], total: 0, last_page: 1 }));
  const { result } = renderHook(() => useAgendaSemanal({ inicio: '2026-09-25', filtros: {}, paginas: {} }));
  await waitFor(() => expect(result.current.grupos['2026-09-26']?.loading).toBe(false));
  expect(result.current.grupos['2026-09-25']?.loading).toBe(true);
  await act(async () => { resolveFirst({ data: [], total: 0, last_page: 1 }); });
});
