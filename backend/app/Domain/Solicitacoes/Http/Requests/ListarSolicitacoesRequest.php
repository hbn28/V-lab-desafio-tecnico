<?php

namespace App\Domain\Solicitacoes\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ListarSolicitacoesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status'    => ['nullable', 'string', 'in:RECEBIDA,EM_ANALISE,AGENDADA,CONCLUIDA,CANCELADA'],
            'status_grupo' => ['nullable', 'string', 'in:aberto,encerrado'],
            'categoria' => ['nullable', 'string', 'in:CONSULTA,EXAME,VACINACAO,OUTRO'],
            'prioridade' => ['nullable', 'string', 'in:BAIXA,MEDIA,ALTA,URGENTE'],
            'page'      => ['nullable', 'integer', 'min:1'],
            'per_page'  => ['nullable', 'integer', 'min:1', 'max:100'],
            'data_agendada' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if (! $this->filled('data_agendada')) {
                return;
            }

            if ($this->filled('status') && $this->input('status') !== 'AGENDADA') {
                $validator->errors()->add('status', 'O filtro de data aceita apenas o status AGENDADA.');
            }
            if ($this->input('status_grupo') === 'encerrado') {
                $validator->errors()->add('status_grupo', 'A agenda diária não pertence ao histórico encerrado.');
            }
        });
    }
}
