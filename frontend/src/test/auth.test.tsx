import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import App from '../App';

test('entrada anônima mostra formulário de login', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    text: async () => JSON.stringify({ message: 'Autenticação necessária.', errors: {} }),
  }));

  render(<App />);
  expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/usuário ou e-mail/i)).toHaveAttribute('type', 'text');
  expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
});
