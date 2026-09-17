<?php

namespace App\Domain\Solicitacoes\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CriarSolicitacaoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nome_solicitante'        => ['required', 'string', 'max:255'],
            'categoria'               => ['required', 'string', 'in:CONSULTA,EXAME,VACINACAO,OUTRO'],
            'prioridade'              => ['required', 'string', 'in:BAIXA,MEDIA,ALTA,URGENTE'],
            'descricao'               => ['required', 'string', 'max:2000'],
            'justificativa_prioridade' => ['nullable', 'string', 'max:1000'],
            // campos que não devem ser aceitos
            'id'        => ['prohibited'],
            'protocolo' => ['prohibited'],
            'status'    => ['prohibited'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if (
                $this->input('prioridade') === 'URGENTE' &&
                blank(trim($this->input('justificativa_prioridade', '')))
            ) {
                $validator->errors()->add(
                    'justificativa_prioridade',
                    'A justificativa é obrigatória para prioridade URGENTE.'
                );
            }
        });
    }
}
