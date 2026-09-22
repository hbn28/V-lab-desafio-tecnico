<?php

namespace App\Domain\Solicitacoes\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ListarFaltasRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'data' => ['nullable', 'date_format:Y-m-d'],
            'resultado_contato' => ['nullable', 'string', 'in:SEM_RESPOSTA,RECADO,CONFIRMOU_RETORNO,NUMERO_INVALIDO'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
