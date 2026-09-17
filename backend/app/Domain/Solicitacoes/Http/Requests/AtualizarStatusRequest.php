<?php

namespace App\Domain\Solicitacoes\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AtualizarStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', 'in:RECEBIDA,EM_ANALISE,AGENDADA,CONCLUIDA,CANCELADA'],
        ];
    }
}
