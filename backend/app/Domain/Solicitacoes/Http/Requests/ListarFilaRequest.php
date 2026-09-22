<?php

namespace App\Domain\Solicitacoes\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ListarFilaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'prioridade' => ['nullable', 'string', 'in:BAIXA,MEDIA,ALTA,URGENTE'],
            'categoria' => ['nullable', 'string', 'in:CONSULTA,EXAME,VACINACAO,OUTRO'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
