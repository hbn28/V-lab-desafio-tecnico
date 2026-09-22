<?php

namespace App\Domain\Solicitacoes\Http\Requests;

use App\Domain\Solicitacoes\Support\HorarioAgendamento;
use App\Domain\Solicitacoes\Support\TurnoAgendamento;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

class ReagendarAposFaltaRequest extends FormRequest
{
    private const CAMPOS_PERMITIDOS = ['data_agendada', 'hora_agendada', 'turno'];

    /** @var array{modalidade:string,data_agendada:string,hora_agendada:?string,turno:string,agendado_para:?CarbonImmutable}|null */
    private ?array $dadosAgendamento = null;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'data_agendada' => ['required', 'date_format:Y-m-d'],
            'hora_agendada' => ['nullable', 'date_format:H:i'],
            'turno' => ['nullable', 'string', 'in:'.implode(',', TurnoAgendamento::TURNOS)],
        ];
    }

    public function messages(): array
    {
        return [
            'data_agendada.required' => 'Informe a data do atendimento.',
            'data_agendada.date_format' => 'A data do atendimento deve estar no formato AAAA-MM-DD.',
            'hora_agendada.date_format' => 'O horário do atendimento deve estar no formato HH:mm.',
            'turno.in' => 'O turno deve ser MANHA, TARDE ou NOITE.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            foreach (array_diff(array_keys($this->all()), self::CAMPOS_PERMITIDOS) as $campo) {
                $validator->errors()->add((string) $campo, "O campo {$campo} não é permitido.");
            }

            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $temHora = $this->filled('hora_agendada');
            $temTurno = $this->filled('turno');

            if ($temHora === $temTurno) {
                $validator->errors()->add($temHora ? 'turno' : 'hora_agendada', 'Informe horário ou turno, mas não ambos.');

                return;
            }

            $timezone = config('agendamento.timezone');

            if ($temHora) {
                $instante = HorarioAgendamento::interpretarLocal($this->input('data_agendada'), $this->input('hora_agendada'), $timezone);

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
                    'data_agendada' => $this->input('data_agendada'),
                    'hora_agendada' => $this->input('hora_agendada'),
                    'turno' => TurnoAgendamento::derivarDaHora($this->input('hora_agendada')),
                    'agendado_para' => $instante,
                ];

                return;
            }

            $fimTurno = TurnoAgendamento::fimDoTurnoUtc($this->input('data_agendada'), $this->input('turno'), $timezone);

            if (! $fimTurno->greaterThan(CarbonImmutable::now())) {
                $validator->errors()->add('data_agendada', 'O agendamento deve ser em um instante futuro.');

                return;
            }

            $this->dadosAgendamento = [
                'modalidade' => 'TURNO',
                'data_agendada' => $this->input('data_agendada'),
                'hora_agendada' => null,
                'turno' => $this->input('turno'),
                'agendado_para' => null,
            ];
        });
    }

    public function dadosAgendamento(): array
    {
        return $this->dadosAgendamento;
    }
}
