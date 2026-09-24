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

it('mantém a mesma quantidade de campos ao trocar a ordenação, para o botão não mudar de lugar', () => {
  const { container } = render(<SolicitacoesToolbar
    consulta={{ ordenar_por: 'prioridade' }}
    opcoesOrdenacao={['prioridade', 'horario']}
    total={0}
    mostrarStatus
    mostrarCategoria
    mostrarPrioridade
    mostrarPeriodo
    onApply={vi.fn()}
  />);
  const campos = () => container.querySelectorAll('.collection-toolbar > .filter-field').length;
  const antes = campos();

  expect(screen.getByLabelText('Ordem')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'horario' } });
  expect(screen.getByLabelText('Ordem')).toBeEnabled();
  expect(campos()).toBe(antes);

  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'RECEBIDA' } });
  expect(campos()).toBe(antes);
  expect(screen.getByRole('button', { name: /aplicar filtros/i }).parentElement).toHaveClass('collection-toolbar__actions');
});

it('mostra no seletor a ordenação que o status escolhido impõe, mesmo antes de aplicar', () => {
  render(<SolicitacoesToolbar
    consulta={{ ordenar_por: 'prioridade' }}
    opcoesOrdenacao={['prioridade', 'data']}
    total={0}
    mostrarStatus
    onApply={vi.fn()}
  />);

  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'AGENDADA' } });
  expect(screen.getByLabelText('Ordenar por')).toHaveDisplayValue('Horário');
  expect(screen.getByLabelText('Ordem')).toBeEnabled();
});
