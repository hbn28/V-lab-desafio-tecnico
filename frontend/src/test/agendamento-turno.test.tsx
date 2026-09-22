import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AgendamentoForm } from '../features/solicitacoes/components/AgendamentoForm';

describe('AgendamentoForm com horario ou turno', () => {
  it('deriva Manha quando horario e 07:00', async () => {
    const onSubmit = vi.fn();
    render(<AgendamentoForm onSubmit={onSubmit} onCancel={vi.fn()} submitLabel="Salvar" />);
    await userEvent.click(screen.getByRole('radio', { name: 'Horário exato' }));
    await userEvent.type(screen.getByLabelText('Data do atendimento'), '2026-09-25');
    await userEvent.type(screen.getByLabelText('Horário do atendimento'), '07:00');
    expect(screen.getByText('Turno: Manhã')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSubmit).toHaveBeenCalledWith({ data_agendada: '2026-09-25', hora_agendada: '07:00' });
  });

  it('envia turno sem hora', async () => {
    const onSubmit = vi.fn();
    render(<AgendamentoForm onSubmit={onSubmit} onCancel={vi.fn()} submitLabel="Salvar" />);
    await userEvent.click(screen.getByRole('radio', { name: 'Turno' }));
    await userEvent.type(screen.getByLabelText('Data do atendimento'), '2026-09-25');
    await userEvent.selectOptions(screen.getByLabelText('Turno do atendimento'), 'TARDE');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSubmit).toHaveBeenCalledWith({ data_agendada: '2026-09-25', turno: 'TARDE' });
  });
});
