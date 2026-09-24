<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Agendamento;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Faltas que ainda exigem ação da equipe (contato ou reagendamento).
 *
 * Uma falta deixa de ser pendente — sem perder o registro, que continua com
 * status FALTA como histórico — quando:
 *  - a solicitação já recebeu um agendamento posterior (reagendada), ou
 *  - a solicitação saiu de AGENDADA (foi cancelada ou concluída).
 */
class ListarFaltasPendentes
{
    /**
     * @param  array{data?: ?string, resultado_contato?: ?string, per_page?: ?int}  $filtros
     */
    public function execute(array $filtros): LengthAwarePaginator
    {
        return Agendamento::query()
            ->where('status', 'FALTA')
            ->whereHas('solicitacao', fn ($solicitacao) => $solicitacao->where('status', 'AGENDADA'))
            ->whereNotExists(function ($posterior) {
                $posterior->selectRaw('1')
                    ->from('agendamentos as posterior')
                    ->whereColumn('posterior.solicitacao_id', 'agendamentos.solicitacao_id')
                    ->whereColumn('posterior.id', '>', 'agendamentos.id');
            })
            ->with(['solicitacao.paciente', 'ultimaTentativaContato'])
            ->when($filtros['data'] ?? null, fn ($query, $data) => $query->whereDate('data_agendada', $data))
            ->when(
                $filtros['resultado_contato'] ?? null,
                fn ($query, $resultado) => $query->whereHas(
                    'ultimaTentativaContato',
                    fn ($tentativa) => $tentativa->where('resultado', $resultado)
                )
            )
            ->orderByDesc('falta_registrada_em')
            ->orderByDesc('id')
            ->paginate((int) ($filtros['per_page'] ?? 15));
    }
}
