import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { DrilldownModal } from '../features/solicitacoes/components/DrilldownModal';
import { Layout } from '../components/Layout';
import { ThemeProvider } from '../features/theme/ThemeProvider';
import { SolicitacaoForm } from '../features/solicitacoes/components/SolicitacaoForm';

vi.mock('../features/auth/context', () => ({
  useAuth: () => ({ user: { name: 'Operador', role: 'ADMINISTRADOR' }, logout: vi.fn() }),
}));

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


test('main navigation has an accessible name and Tab starts with the skip link', async () => {
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/']}>
        <Layout />
      </MemoryRouter>
    </ThemeProvider>,
  );
  const skip = screen.getByRole('link', { name: /Ir para o conte/ });
  const navigation = screen.getByRole('navigation');
  expect(navigation).toHaveAttribute('aria-label', expect.stringMatching(/Navega/));

  await user.tab();
  expect(skip).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('link', { name: /Solicita.*inicial/i })).toHaveFocus();
  await user.tab();
  expect(within(navigation).getByRole('link', { name: 'Fila' })).toHaveFocus();

  await user.click(within(navigation).getByRole('link', { name: /agendadas/ }));
  expect(within(navigation).getByRole('link', { name: /agendadas/ })).toHaveAttribute('aria-current', 'page');
});

test('creation form exposes accessible labels for required fields and optional phone', () => {
  render(
    <SolicitacaoForm
      eyebrow="New request"
      heading="Requester details"
      mostrarCelular
      submitLabel="Create request"
      onSubmit={async () => undefined}
      onCancel={vi.fn()}
    />,
  );

  expect(screen.getByRole('textbox', { name: /Nome do Solicitante/i })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'CPF' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: /Celular/ })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /Categoria/ })).toBeInTheDocument();
});
