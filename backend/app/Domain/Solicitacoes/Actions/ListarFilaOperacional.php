<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\EntradaFila;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Fila operacional contínua: entradas abertas (EM_ANALISE ainda não agendadas),
 * maior prioridade primeiro e, em empate, quem entrou antes.
 */
class ListarFilaOperacional
{
    /**
     * @param  array{prioridade?: ?string, categoria?: ?string, per_page?: ?int}  $filtros
     */
    public function execute(array $filtros): LengthAwarePaginator
    {
        return EntradaFila::query()
            ->whereNull('encerrada_em')
            ->with(['solicitacao.paciente'])
            ->join('solicitacoes', 'solicitacoes.id', '=', 'entradas_fila.solicitacao_id')
            ->when($filtros['prioridade'] ?? null, fn ($query, $prioridade) => $query->where('solicitacoes.prioridade', $prioridade))
            ->when($filtros['categoria'] ?? null, fn ($query, $categoria) => $query->where('solicitacoes.categoria', $categoria))
            ->orderByRaw("CASE solicitacoes.prioridade WHEN 'URGENTE' THEN 4 WHEN 'ALTA' THEN 3 WHEN 'MEDIA' THEN 2 ELSE 1 END DESC")
            ->orderBy('entradas_fila.entrou_em')
            ->orderBy('entradas_fila.id')
            ->select('entradas_fila.*')
            ->paginate((int) ($filtros['per_page'] ?? 15));
    }
}
