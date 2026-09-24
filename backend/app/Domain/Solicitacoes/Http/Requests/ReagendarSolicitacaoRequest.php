<?php

namespace App\Domain\Solicitacoes\Http\Requests;

use App\Domain\Solicitacoes\Http\Requests\Concerns\ValidaAgendamento;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ReagendarSolicitacaoRequest extends FormRequest
{
    use ValidaAgendamento;

    private const CAMPOS_PERMITIDOS = ['data_agendada', 'hora_agendada', 'turno'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $regras = $this->regrasDeAgendamento();
        array_unshift($regras['data_agendada'], 'required');

        return $regras;
    }

    public function messages(): array
    {
        return $this->mensagensDeAgendamento();
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $this->rejeitarCamposNaoPermitidos($validator);

            if ($validator->errors()->isEmpty()) {
                $this->validarAgendamento($validator);
            }
        });
    }
}
