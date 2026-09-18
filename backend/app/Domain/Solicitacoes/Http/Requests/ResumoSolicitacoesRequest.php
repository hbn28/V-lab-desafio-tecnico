<?php

namespace App\Domain\Solicitacoes\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ResumoSolicitacoesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Sem 'status': cada bloco do painel já é uma quebra por status
            // (ou por prioridade 'em aberto'), então filtrar por um único
            // status não faz sentido aqui — o filtro de status da listagem
            // não se aplica a este resumo, de propósito.
            'categoria'  => ['nullable', 'string', 'in:CONSULTA,EXAME,VACINACAO,OUTRO'],
            'prioridade' => ['nullable', 'string', 'in:BAIXA,MEDIA,ALTA,URGENTE'],
        ];
    }
}
