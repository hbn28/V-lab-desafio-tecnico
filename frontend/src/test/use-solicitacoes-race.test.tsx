import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { solicitacoesApi } from '../features/solicitacoes/api/client';
import { useFaltas, useSolicitacao, useSolicitacoes } from '../features/solicitacoes/hooks/useSolicitacoes';

vi.mock('../features/solicitacoes/api/client', () => ({
  solicitacoesApi: {
    listar: vi.fn(),
    listarFaltas: vi.fn(),
    buscar: vi.fn(),
    resumo: vi.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const list = (protocol: string) => ({
  data: [{ id: 1, protocolo: protocol } as never], total: 1, last_page: 1, current_page: 1,
});

const faltas = (protocol: string) => ({
  data: [{ id: 1, solicitacao: { protocolo: protocol } } as never],
  meta: { total: 1, per_page: 10, current_page: 1, last_page: 1 },
  links: { first: null, last: null, next: null, prev: null },
});

describe('respostas de filtros concorrentes', () => {
  it('limpa dados do detalhe anterior e ignora resposta atrasada ao trocar o id', async () => {
    const oldRequest = deferred<never>();
    const newRequest = deferred<never>();
    vi.mocked(solicitacoesApi.buscar).mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    const { result, rerender } = renderHook(({ id }) => useSolicitacao(id), { initialProps: { id: '1' } });
    rerender({ id: '2' });
    expect(result.current.data).toBeNull();
    await act(async () => { newRequest.resolve({ id: 2, protocolo: 'SOL-2026-0002' } as never); });
    await waitFor(() => expect(result.current.data?.id).toBe(2));
    await act(async () => { oldRequest.resolve({ id: 1, protocolo: 'SOL-2026-0001' } as never); });
    expect(result.current.data?.id).toBe(2);
  });
  it('ignora uma lista antiga quando a busca mais recente já terminou', async () => {
    const oldRequest = deferred<ReturnType<typeof list>>();
    const newRequest = deferred<ReturnType<typeof list>>();
    vi.mocked(solicitacoesApi.listar).mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    const { result, rerender } = renderHook(({ q }: { q: string }) => useSolicitacoes({ q }), { initialProps: { q: 'A' } });

    rerender({ q: 'B' });
    await waitFor(() => expect(solicitacoesApi.listar).toHaveBeenCalledTimes(2));
    await act(async () => { newRequest.resolve(list('SOL-2026-0002')); });
    await waitFor(() => expect(result.current.data?.data[0]?.protocolo).toBe('SOL-2026-0002'));
    await act(async () => { oldRequest.resolve(list('SOL-2026-0001')); });

    expect(result.current.data?.data[0]?.protocolo).toBe('SOL-2026-0002');
  });

  it('ignora uma resposta antiga da aba de faltas após aplicar outro filtro', async () => {
    const oldRequest = deferred<ReturnType<typeof faltas>>();
    const newRequest = deferred<ReturnType<typeof faltas>>();
    vi.mocked(solicitacoesApi.listarFaltas).mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    const { result, rerender } = renderHook(({ q }: { q: string }) => useFaltas({ filtros: { q } }), { initialProps: { q: 'A' } });

    rerender({ q: 'B' });
    await waitFor(() => expect(solicitacoesApi.listarFaltas).toHaveBeenCalledTimes(2));
    await act(async () => { newRequest.resolve(faltas('SOL-2026-0002')); });
    await waitFor(() => expect(result.current.data?.data[0]?.solicitacao?.protocolo).toBe('SOL-2026-0002'));
    await act(async () => { oldRequest.resolve(faltas('SOL-2026-0001')); });

    expect(result.current.data?.data[0]?.solicitacao?.protocolo).toBe('SOL-2026-0002');
  });
});
