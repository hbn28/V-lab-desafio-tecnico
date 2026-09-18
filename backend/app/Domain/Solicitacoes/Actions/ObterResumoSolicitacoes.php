<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Solicitacao;
use Illuminate\Support\Carbon;

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
     * @return array{status: array<string,int>, prioridade_aberta: array<string,int>, mais_antiga_aberta: array<string,?string>, total: int, filtros_aplicados: array<string,mixed>}
     */
    public function execute(?string $categoria, ?string $prioridade): array
    {
        $statusVazio = array_fill_keys(
            ['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA'],
            0
        );
        $prioridadeVazia = array_fill_keys(['URGENTE', 'ALTA', 'MEDIA', 'BAIXA'], 0);
        $prioridadeSemData = array_fill_keys(['URGENTE', 'ALTA', 'MEDIA', 'BAIXA'], null);

        $porStatus = Solicitacao::query()
            ->when($categoria, fn ($query) => $query->where('categoria', $categoria))
            ->when($prioridade, fn ($query) => $query->where('prioridade', $prioridade))
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->map(fn ($total) => (int) $total)
            ->all();

        // Mesma consulta serve pra contagem e pra "há quanto tempo a mais antiga
        // está esperando" (MIN(created_at)) — é o sinal de urgência real que o
        // contador sozinho não dá.
        $porPrioridadeAberta = Solicitacao::query()
            ->whereNotIn('status', ['CONCLUIDA', 'CANCELADA'])
            ->when($categoria, fn ($query) => $query->where('categoria', $categoria))
            ->selectRaw('prioridade, count(*) as total, min(created_at) as mais_antiga')
            ->groupBy('prioridade')
            ->get();

        $contagemPrioridade = $porPrioridadeAberta->mapWithKeys(
            fn ($linha) => [$linha->prioridade => (int) $linha->total]
        )->all();

        // O alias 'mais_antiga' não bate com nenhuma chave de $casts do model,
        // então chega aqui como string crua do driver — parseia explicitamente.
        $maisAntigaPrioridade = $porPrioridadeAberta->mapWithKeys(
            fn ($linha) => [$linha->prioridade => Carbon::parse($linha->mais_antiga)->toIso8601String()]
        )->all();

        return [
            'status'             => array_merge($statusVazio, $porStatus),
            'prioridade_aberta'  => array_merge($prioridadeVazia, $contagemPrioridade),
            'mais_antiga_aberta' => array_merge($prioridadeSemData, $maisAntigaPrioridade),
            'total'              => array_sum(array_merge($statusVazio, $porStatus)),
            'filtros_aplicados'  => [
                'categoria'  => $categoria,
                'prioridade' => $prioridade,
            ],
        ];
    }
}
