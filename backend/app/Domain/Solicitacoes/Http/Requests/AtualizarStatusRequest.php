<?php

namespace App\Domain\Solicitacoes\Http\Requests;

use App\Domain\Solicitacoes\Http\Requests\Concerns\ValidaAgendamento;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AtualizarStatusRequest extends FormRequest
{
    use ValidaAgendamento;

    private const CAMPOS_PERMITIDOS = ['status', 'data_agendada', 'hora_agendada', 'turno'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $agendando = fn () => $this->input('status') === 'AGENDADA';
        $outroDestino = fn () => $this->filled('status') && $this->input('status') !== 'AGENDADA';
        $regras = $this->regrasDeAgendamento();

        return [
            'status' => ['required', 'string', 'in:RECEBIDA,EM_ANALISE,AGENDADA,CONCLUIDA,CANCELADA'],
            'data_agendada' => [Rule::requiredIf($agendando), Rule::prohibitedIf($outroDestino), ...$regras['data_agendada']],
            'hora_agendada' => [Rule::prohibitedIf($outroDestino), ...$regras['hora_agendada']],
            'turno' => [Rule::prohibitedIf($outroDestino), ...$regras['turno']],
        ];
    }

    public function messages(): array
    {
        return $this->mensagensDeAgendamento() + [
            'data_agendada.prohibited' => 'A data do atendimento só é aceita ao agendar.',
            'hora_agendada.prohibited' => 'O horário do atendimento só é aceito ao agendar.',
            'turno.prohibited' => 'O turno só é aceito ao agendar.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $this->rejeitarCamposNaoPermitidos($validator);

            if ($validator->errors()->isEmpty() && $this->input('status') === 'AGENDADA') {
                $this->validarAgendamento($validator);
            }
        });
    }
}
