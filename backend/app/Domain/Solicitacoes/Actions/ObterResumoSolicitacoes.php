<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Solicitacao;

class ObterResumoSolicitacoes
{
    /**
     * Contagens globais (não paginadas) usadas pelo painel e pelo drill-down.
     *
     * Cada bloco do painel exclui do filtro a própria dimensão que ele
     * detalha, e aplica as demais: "Andamento da fila" (quebra por status)
     * respeita categoria e prioridade; "Prioridades em aberto" (quebra por
     * prioridade) respeita categoria. O filtro de status da listagem nunca
     * chega aqui — nenhum dos dois blocos faz sentido restrito a um status.
     *
     * @return array{status: array<string,int>, prioridade_aberta: array<string,int>, total: int, filtros_aplicados: array<string,mixed>}
     */
    public function execute(?string $categoria, ?string $prioridade): array
    {
        $statusVazio = array_fill_keys(
            ['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA'],
            0
        );
        $prioridadeVazia = array_fill_keys(['URGENTE', 'ALTA', 'MEDIA', 'BAIXA'], 0);

        $porStatus = Solicitacao::query()
            ->when($categoria, fn ($query) => $query->where('categoria', $categoria))
            ->when($prioridade, fn ($query) => $query->where('prioridade', $prioridade))
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->map(fn ($total) => (int) $total)
            ->all();

        $porPrioridadeAberta = Solicitacao::query()
            ->whereNotIn('status', ['CONCLUIDA', 'CANCELADA'])
            ->when($categoria, fn ($query) => $query->where('categoria', $categoria))
            ->selectRaw('prioridade, count(*) as total')
            ->groupBy('prioridade')
            ->pluck('total', 'prioridade')
            ->map(fn ($total) => (int) $total)
            ->all();

        return [
            'status'            => array_merge($statusVazio, $porStatus),
            'prioridade_aberta' => array_merge($prioridadeVazia, $porPrioridadeAberta),
            'total'             => array_sum(array_merge($statusVazio, $porStatus)),
            'filtros_aplicados' => [
                'categoria'  => $categoria,
                'prioridade' => $prioridade,
            ],
        ];
    }
}
