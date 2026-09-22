import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { DrilldownModal } from '../features/solicitacoes/components/DrilldownModal';

vi.mock('../features/solicitacoes/hooks/useSolicitacoes', () => ({
  useSolicitacoes: () => ({ data: null, loading: true, error: null }),
}));

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <MemoryRouter>
      <button onClick={() => setOpen(true)}>Abrir painel</button>
      {open && <DrilldownModal title="Solicitações" accent="neutro" filtros={{}} onClose={() => setOpen(false)} />}
    </MemoryRouter>
  );
}

test('diálogo mantém o foco com Tab e devolve o foco ao fechar', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Abrir painel' });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Solicitações' });
  const close = screen.getByRole('button', { name: 'Fechar' });
  expect(close).toHaveFocus();

  await user.keyboard('{Shift>}{Tab}{/Shift}');
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  await user.tab();
  expect(dialog).toContainElement(document.activeElement as HTMLElement);

  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
});
