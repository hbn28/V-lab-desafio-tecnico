import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SolicitacoesToolbar } from '../features/solicitacoes/components/SolicitacoesToolbar';

describe('filtros da coleção', () => {
  it('mantém os critérios em edição até aplicar e mostra filtros ativos removíveis', () => {
    const onApply = vi.fn();
    render(<SolicitacoesToolbar
      consulta={{ prioridade: 'URGENTE', q: 'SOL-2026', ordenar_por: 'prioridade' }}
      opcoesOrdenacao={['prioridade', 'data']}
      total={4}
      mostrarCategoria
      mostrarPrioridade
      onApply={onApply}
    />);

    fireEvent.change(screen.getByRole('searchbox', { name: /buscar solicitações/i }), { target: { value: 'Maria' } });
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /aplicar filtros/i }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ q: 'Maria', prioridade: 'URGENTE' }));
    expect(screen.getByText(/4 resultados/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remover filtro prioridade urgente/i })).toBeInTheDocument();
  });
});

it('preserva a busca digitada quando o pai recria as opções de ordenação', () => {
  const onApply = vi.fn();
  const consulta = { ordenar_por: 'prioridade' as const };
  const { rerender } = render(<SolicitacoesToolbar consulta={consulta} opcoesOrdenacao={['prioridade', 'data']} total={0} onApply={onApply} />);
  const search = screen.getByRole('searchbox', { name: /buscar solicitações/i });
  fireEvent.change(search, { target: { value: 'Maria' } });
  rerender(<SolicitacoesToolbar consulta={consulta} opcoesOrdenacao={['prioridade', 'data']} total={1} onApply={onApply} />);
  expect(search).toHaveValue('Maria');
});
