<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Agendamento;
use App\Models\EntradaFila;
use App\Models\Solicitacao;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class AtualizarStatusSolicitacao
{
    /** @var array<string, string[]> */
    private const TRANSICOES = [
        'RECEBIDA' => ['EM_ANALISE', 'CANCELADA'],
        'EM_ANALISE' => ['AGENDADA', 'CANCELADA'],
        'AGENDADA' => ['CONCLUIDA', 'CANCELADA'],
        'CONCLUIDA' => [],
        'CANCELADA' => [],
    ];

    /**
     * @param  array{modalidade:string,data_agendada:string,hora_agendada:?string,turno:string,agendado_para:?\Carbon\CarbonImmutable}|null  $agendamento
     */
    public function execute(
        Solicitacao $solicitacao,
        string $novoStatus,
        ?array $agendamento = null,
    ): Solicitacao {
        return DB::transaction(function () use ($solicitacao, $novoStatus, $agendamento) {
            // Relê com lock para evitar race condition
            $solicitacao = Solicitacao::lockForUpdate()->findOrFail($solicitacao->id);

            $permitidos = self::TRANSICOES[$solicitacao->status] ?? [];

            if (! in_array($novoStatus, $permitidos, true)) {
                $this->conflito(
                    "Transição de '{$solicitacao->status}' para '{$novoStatus}' não é permitida."
                );
            }

            if ($novoStatus === 'AGENDADA' && $agendamento === null) {
                $this->conflito('A data e o horário ou turno são obrigatórios para agendar a solicitação.');
            }

            // Concluir/cancelar preservam agendado_para como histórico; só AGENDADA o escreve.
            $dados = ['status' => $novoStatus];
            if ($novoStatus === 'AGENDADA') {
                $dados['agendado_para'] = $agendamento['agendado_para'];
            }

            $solicitacao->update($dados);

            if ($novoStatus === 'EM_ANALISE') {
                EntradaFila::query()->firstOrCreate(
                    ['solicitacao_id' => $solicitacao->id, 'encerrada_em' => null],
                    ['entrou_em' => now()]
                );
            }

            if ($novoStatus === 'AGENDADA') {
                Agendamento::query()->create([
                    'solicitacao_id' => $solicitacao->id,
                    'data_agendada' => $agendamento['data_agendada'],
                    'modalidade' => $agendamento['modalidade'],
                    'hora_agendada' => $agendamento['hora_agendada'],
                    'turno' => $agendamento['turno'],
                    'status' => 'AGENDADO',
                ]);

                $this->encerrarFilaAberta($solicitacao, 'AGENDAMENTO');
            }

            if ($novoStatus === 'CANCELADA') {
                $this->encerrarFilaAberta($solicitacao, 'CANCELAMENTO');
            }

            return $solicitacao->fresh();
        });
    }

    private function encerrarFilaAberta(Solicitacao $solicitacao, string $motivo): void
    {
        EntradaFila::query()
            ->where('solicitacao_id', $solicitacao->id)
            ->whereNull('encerrada_em')
            ->lockForUpdate()
            ->update(['encerrada_em' => now(), 'motivo_encerramento' => $motivo]);
    }

    private function conflito(string $mensagem): never
    {
        throw new HttpResponseException(
            response()->json(['message' => $mensagem, 'errors' => []], 409)
        );
    }
}
