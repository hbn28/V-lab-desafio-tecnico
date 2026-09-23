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
            'data_de' => ['nullable', 'date_format:Y-m-d'],
            'data_ate' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:data_de'],
            'q' => ['nullable', 'string', 'max:100'],
            'prioridade' => ['nullable', 'in:BAIXA,MEDIA,ALTA,URGENTE'],
            'ordenar_por' => ['nullable', 'in:prioridade,data,horario'],
            'direcao' => ['nullable', 'in:asc,desc'],
            'resultado_contato' => ['nullable', 'string', 'in:SEM_RESPOSTA,RECADO,CONFIRMOU_RETORNO,NUMERO_INVALIDO'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($this->filled('data') && $this->input('ordenar_por') === 'data') {
                $validator->errors()->add('ordenar_por', 'A ordenação por data não se aplica a um único dia.');
            }
        });
    }
}
