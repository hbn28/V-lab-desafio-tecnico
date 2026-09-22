<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Agendamento;
use App\Models\Solicitacao;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

/**
 * Altera a marcação ativa (agendado_para e o Agendamento AGENDADO) de uma
 * solicitação já AGENDADA. Nunca muda o status: AtualizarStatusSolicitacao
 * segue como única autoridade de transições.
 */
class ReagendarSolicitacao
{
    /**
     * @param  array{modalidade:string,data_agendada:string,hora_agendada:?string,turno:string,agendado_para:?\Carbon\CarbonImmutable}  $dadosAgendamento
     */
    public function execute(Solicitacao $solicitacao, array $dadosAgendamento): Solicitacao
    {
        return DB::transaction(function () use ($solicitacao, $dadosAgendamento) {
            $solicitacao = Solicitacao::lockForUpdate()->findOrFail($solicitacao->id);

            if ($solicitacao->status !== 'AGENDADA') {
                throw new HttpResponseException(response()->json([
                    'message' => 'Somente solicitações agendadas podem ser reagendadas.',
                    'errors' => [],
                ], 409));
            }

            $agendamentoAtivo = Agendamento::query()
                ->where('solicitacao_id', $solicitacao->id)
                ->where('status', 'AGENDADO')
                ->lockForUpdate()
                ->first();

            $horaAtiva = $agendamentoAtivo?->hora_agendada !== null
                ? substr($agendamentoAtivo->hora_agendada, 0, 5)
                : null;

            $identico = $agendamentoAtivo !== null
                && $agendamentoAtivo->modalidade === $dadosAgendamento['modalidade']
                && $agendamentoAtivo->data_agendada->toDateString() === $dadosAgendamento['data_agendada']
                && $horaAtiva === $dadosAgendamento['hora_agendada']
                && $agendamentoAtivo->turno === $dadosAgendamento['turno'];

            if ($identico) {
                return $solicitacao;
            }

            $solicitacao->update(['agendado_para' => $dadosAgendamento['agendado_para']]);

            $camposAgendamento = [
                'data_agendada' => $dadosAgendamento['data_agendada'],
                'modalidade' => $dadosAgendamento['modalidade'],
                'hora_agendada' => $dadosAgendamento['hora_agendada'],
                'turno' => $dadosAgendamento['turno'],
            ];

            if ($agendamentoAtivo !== null) {
                $agendamentoAtivo->update($camposAgendamento);
            } else {
                // Solicitação agendada antes desta feature, sem Agendamento correspondente.
                Agendamento::query()->create($camposAgendamento + [
                    'solicitacao_id' => $solicitacao->id,
                    'status' => 'AGENDADO',
                ]);
            }

            return $solicitacao->fresh();
        });
    }
}
