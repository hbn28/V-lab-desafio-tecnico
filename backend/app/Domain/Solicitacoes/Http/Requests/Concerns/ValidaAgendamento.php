<?php

namespace App\Domain\Solicitacoes\Http\Requests\Concerns;

use App\Domain\Solicitacoes\Support\HorarioAgendamento;
use App\Domain\Solicitacoes\Support\TurnoAgendamento;
use Carbon\CarbonImmutable;
use Illuminate\Validation\Validator;

/**
 * Validação comum a todo pedido que marca um atendimento (agendar, reagendar e
 * reagendar após falta): exatamente um entre horário exato e turno, interpretado
 * no fuso operacional e sempre no futuro.
 *
 * Quem usa o trait declara CAMPOS_PERMITIDOS e chama validarAgendamento() no
 * after() do validator; o resultado normalizado fica em dadosAgendamento().
 */
trait ValidaAgendamento
{
    /** @var array{modalidade:string,data_agendada:string,hora_agendada:?string,turno:string,agendado_para:?CarbonImmutable}|null */
    private ?array $dadosAgendamento = null;

    /**
     * @return array{modalidade:string,data_agendada:string,hora_agendada:?string,turno:string,agendado_para:?CarbonImmutable}|null
     */
    public function dadosAgendamento(): ?array
    {
        return $this->dadosAgendamento;
    }

    /** @return array<string, array<int, mixed>> */
    protected function regrasDeAgendamento(): array
    {
        return [
            'data_agendada' => ['date_format:Y-m-d'],
            'hora_agendada' => ['nullable', 'date_format:H:i'],
            'turno' => ['nullable', 'string', 'in:'.implode(',', TurnoAgendamento::TURNOS)],
        ];
    }

    /** @return array<string, string> */
    protected function mensagensDeAgendamento(): array
    {
        return [
            'data_agendada.required' => 'Informe a data do atendimento.',
            'data_agendada.date_format' => 'A data do atendimento deve estar no formato AAAA-MM-DD.',
            'hora_agendada.date_format' => 'O horário do atendimento deve estar no formato HH:mm.',
            'turno.in' => 'O turno deve ser MANHA, TARDE ou NOITE.',
        ];
    }

    protected function rejeitarCamposNaoPermitidos(Validator $validator): void
    {
        foreach (array_diff(array_keys($this->all()), self::CAMPOS_PERMITIDOS) as $campo) {
            $validator->errors()->add((string) $campo, "O campo {$campo} não é permitido.");
        }
    }

    protected function validarAgendamento(Validator $validator): void
    {
        $temHora = $this->filled('hora_agendada');
        $temTurno = $this->filled('turno');

        // Exatamente um dos dois modos deve ser informado, nunca os dois nem nenhum.
        if ($temHora === $temTurno) {
            $validator->errors()->add($temHora ? 'turno' : 'hora_agendada', 'Informe horário ou turno, mas não ambos.');

            return;
        }

        $data = $this->input('data_agendada');
        $timezone = config('agendamento.timezone');

        if ($temHora) {
            $hora = $this->input('hora_agendada');
            $instante = HorarioAgendamento::interpretarLocal($data, $hora, $timezone);

            if ($instante === null) {
                $validator->errors()->add('data_agendada', 'Data e horário não correspondem a um instante válido no fuso operacional.');

                return;
            }

            if (! $instante->greaterThan(CarbonImmutable::now())) {
                $validator->errors()->add('data_agendada', 'O agendamento deve ser em um instante futuro.');

                return;
            }

            $this->dadosAgendamento = [
                'modalidade' => 'HORARIO',
                'data_agendada' => $data,
                'hora_agendada' => $hora,
                'turno' => TurnoAgendamento::derivarDaHora($hora),
                'agendado_para' => $instante,
            ];

            return;
        }

        $turno = $this->input('turno');

        if (! TurnoAgendamento::fimDoTurnoUtc($data, $turno, $timezone)->greaterThan(CarbonImmutable::now())) {
            $validator->errors()->add('data_agendada', 'O agendamento deve ser em um instante futuro.');

            return;
        }

        $this->dadosAgendamento = [
            'modalidade' => 'TURNO',
            'data_agendada' => $data,
            'hora_agendada' => null,
            'turno' => $turno,
            'agendado_para' => null,
        ];
    }
}
