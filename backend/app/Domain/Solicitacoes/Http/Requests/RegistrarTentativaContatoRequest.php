<?php

namespace App\Domain\Solicitacoes\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RegistrarTentativaContatoRequest extends FormRequest
{
    private const CAMPOS_PERMITIDOS = ['resultado'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'resultado' => ['required', Rule::in(['SEM_RESPOSTA', 'RECADO', 'CONFIRMOU_RETORNO', 'NUMERO_INVALIDO'])],
        ];
    }

    public function messages(): array
    {
        return [
            'resultado.required' => 'Informe o resultado do contato.',
            'resultado.in' => 'O resultado deve ser SEM_RESPOSTA, RECADO, CONFIRMOU_RETORNO ou NUMERO_INVALIDO.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            foreach (array_diff(array_keys($this->all()), self::CAMPOS_PERMITIDOS) as $campo) {
                $validator->errors()->add((string) $campo, "O campo {$campo} não é permitido.");
            }
        });
    }
}
