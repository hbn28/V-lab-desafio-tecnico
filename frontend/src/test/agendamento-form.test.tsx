import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgendamentoForm } from '../features/solicitacoes/components/AgendamentoForm';
import {
  camposDoAgendamento,
  dataHojeNoFuso,
  dataIsoValida,
  formatarAgendamento,
} from '../features/solicitacoes/config/agendamento';

describe('AgendamentoForm', () => {
  it('exige data e hora, foca o resumo e envia valores válidos', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AgendamentoForm submitting={false} serverErrors={{}} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
    expect(screen.getByRole('alert')).toHaveFocus();
    expect(screen.getAllByText('Informe a data do atendimento.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Informe o horário do atendimento.').length).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Data do atendimento'), '2026-09-25');
    await user.type(screen.getByLabelText('Horário do atendimento'), '14:30');
    await user.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
    expect(onSubmit).toHaveBeenCalledWith({ data_agendada: '2026-09-25', hora_agendada: '14:30' });
  });

  it('preenche o valor inicial e usa o rótulo de reagendamento', () => {
    render(
      <AgendamentoForm
        mode="reagendar"
        initialValue={{ data_agendada: '2026-09-25', hora_agendada: '14:30' }}
        submitting={false}
        serverErrors={{}}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Data do atendimento')).toHaveValue('2026-09-25');
    expect(screen.getByLabelText('Horário do atendimento')).toHaveValue('14:30');
    expect(screen.getByRole('button', { name: 'Salvar novo horário' })).toBeInTheDocument();
  });

  it('associa erros do servidor ao campo e preserva os valores digitados', () => {
    const props = { submitting: false, onSubmit: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(
      <AgendamentoForm
        {...props}
        initialValue={{ data_agendada: '2026-09-25', hora_agendada: '14:30' }}
        serverErrors={{}}
      />
    );
    rerender(
      <AgendamentoForm
        {...props}
        initialValue={{ data_agendada: '2026-09-25', hora_agendada: '14:30' }}
        serverErrors={{ hora_agendada: ['O horário deve ser futuro.'] }}
      />
    );

    const hora = screen.getByLabelText('Horário do atendimento');
    expect(hora).toHaveAttribute('aria-invalid', 'true');
    expect(hora).toHaveValue('14:30');
    expect(hora.getAttribute('aria-describedby')).toContain('agendamento-hora_agendada-error');
    expect(document.getElementById('agendamento-hora_agendada-error')).toHaveTextContent('O horário deve ser futuro.');
    expect(screen.getByLabelText('Data do atendimento')).toHaveValue('2026-09-25');
  });

  it('marca a região como ocupada e desabilita a ação durante o envio', () => {
    render(<AgendamentoForm submitting serverErrors={{}} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Data e horário do atendimento' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Data do atendimento')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Confirmar agendamento|Salvando/ })).toBeDisabled();
  });

  it('informa o fuso operacional e chama onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<AgendamentoForm submitting={false} serverErrors={{}} onSubmit={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByText(/Horário local — America\/Recife/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar edição' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('config/agendamento', () => {
  it('formata e extrai campos no fuso operacional', () => {
    expect(formatarAgendamento('2026-09-25T17:30:00Z')).toMatch(/25\/09\/2026.*14:30/);
    expect(camposDoAgendamento('2026-09-25T17:30:00Z')).toEqual({ data_agendada: '2026-09-25', hora_agendada: '14:30' });
  });

  it('calcula o dia atual no fuso, não em UTC', () => {
    expect(dataHojeNoFuso(new Date('2026-09-26T01:00:00Z'))).toBe('2026-09-25');
  });

  it('valida datas ISO sem normalização', () => {
    expect(dataIsoValida('2026-09-25')).toBe(true);
    expect(dataIsoValida('2026-02-31')).toBe(false);
    expect(dataIsoValida('25-09-2026')).toBe(false);
    expect(dataIsoValida(null)).toBe(false);
  });
});
