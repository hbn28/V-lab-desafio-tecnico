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
            'status' => ['nullable', 'string', 'in:RECEBIDA,EM_ANALISE,AGENDADA,CONCLUIDA,CANCELADA'],
            'status_grupo' => ['nullable', 'string', 'in:aberto,encerrado'],
            'categoria' => ['nullable', 'string', 'in:CONSULTA,EXAME,VACINACAO,OUTRO'],
            'prioridade' => ['nullable', 'string', 'in:BAIXA,MEDIA,ALTA,URGENTE'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'data_agendada' => ['nullable', 'date_format:Y-m-d'],
            'data_de' => ['nullable', 'date_format:Y-m-d'],
            'data_ate' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:data_de'],
            'q' => ['nullable', 'string', 'max:100'],
            'ordenar_por' => ['nullable', 'in:prioridade,data,horario'],
            'direcao' => ['nullable', 'in:asc,desc'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($this->filled('ordenar_por') && $this->input('ordenar_por') === 'horario'
                && $this->input('status') !== 'AGENDADA' && ! $this->filled('data_agendada')) {
                $validator->errors()->add('ordenar_por', 'A ordenação por horário exige solicitações agendadas.');
            }
            if ($this->filled('data_agendada') && $this->input('ordenar_por') === 'data') {
                $validator->errors()->add('ordenar_por', 'A ordenação por data não se aplica a um único dia.');
            }
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
