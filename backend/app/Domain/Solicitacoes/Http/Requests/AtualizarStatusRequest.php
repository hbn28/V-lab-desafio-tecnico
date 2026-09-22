<?php

namespace App\Domain\Solicitacoes\Http\Requests;

use App\Domain\Solicitacoes\Support\HorarioAgendamento;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AtualizarStatusRequest extends FormRequest
{
    private const CAMPOS_PERMITIDOS = ['status', 'data_agendada', 'hora_agendada'];

    private ?CarbonImmutable $agendadoPara = null;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', 'in:RECEBIDA,EM_ANALISE,AGENDADA,CONCLUIDA,CANCELADA'],
            'data_agendada' => [
                Rule::requiredIf(fn () => $this->input('status') === 'AGENDADA'),
                Rule::prohibitedIf(fn () => $this->filled('status') && $this->input('status') !== 'AGENDADA'),
                'date_format:Y-m-d',
            ],
            'hora_agendada' => [
                Rule::requiredIf(fn () => $this->input('status') === 'AGENDADA'),
                Rule::prohibitedIf(fn () => $this->filled('status') && $this->input('status') !== 'AGENDADA'),
                'date_format:H:i',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'data_agendada.required' => 'Informe a data do atendimento.',
            'data_agendada.date_format' => 'A data do atendimento deve estar no formato AAAA-MM-DD.',
            'data_agendada.prohibited' => 'A data do atendimento só é aceita ao agendar.',
            'hora_agendada.required' => 'Informe o horário do atendimento.',
            'hora_agendada.date_format' => 'O horário do atendimento deve estar no formato HH:mm.',
            'hora_agendada.prohibited' => 'O horário do atendimento só é aceito ao agendar.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            foreach (array_diff(array_keys($this->all()), self::CAMPOS_PERMITIDOS) as $campo) {
                $validator->errors()->add((string) $campo, "O campo {$campo} não é permitido.");
            }

            if ($validator->errors()->isNotEmpty() || $this->input('status') !== 'AGENDADA') {
                return;
            }

            $instante = HorarioAgendamento::interpretarLocal(
                $this->input('data_agendada'),
                $this->input('hora_agendada'),
                config('agendamento.timezone'),
            );

            if ($instante === null) {
                $validator->errors()->add('data_agendada', 'Data e horário não correspondem a um instante válido no fuso operacional.');
            } elseif (! $instante->greaterThan(CarbonImmutable::now())) {
                $validator->errors()->add('data_agendada', 'O agendamento deve ser em um instante futuro.');
            } else {
                $this->agendadoPara = $instante;
            }
        });
    }

    public function agendadoPara(): ?CarbonImmutable
    {
        return $this->agendadoPara;
    }
}
