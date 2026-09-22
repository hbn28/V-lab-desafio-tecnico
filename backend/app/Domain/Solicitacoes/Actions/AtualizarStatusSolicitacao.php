<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\EntradaFila;
use App\Models\Solicitacao;
use Carbon\CarbonImmutable;
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

    public function execute(
        Solicitacao $solicitacao,
        string $novoStatus,
        ?CarbonImmutable $agendadoPara = null,
    ): Solicitacao {
        return DB::transaction(function () use ($solicitacao, $novoStatus, $agendadoPara) {
            // Relê com lock para evitar race condition
            $solicitacao = Solicitacao::lockForUpdate()->findOrFail($solicitacao->id);

            $permitidos = self::TRANSICOES[$solicitacao->status] ?? [];

            if (! in_array($novoStatus, $permitidos, true)) {
                $this->conflito(
                    "Transição de '{$solicitacao->status}' para '{$novoStatus}' não é permitida."
                );
            }

            if ($novoStatus === 'AGENDADA' && $agendadoPara === null) {
                $this->conflito('A data e o horário são obrigatórios para agendar a solicitação.');
            }

            // Concluir/cancelar preservam agendado_para como histórico; só AGENDADA o escreve.
            $dados = ['status' => $novoStatus];
            if ($novoStatus === 'AGENDADA') {
                $dados['agendado_para'] = $agendadoPara;
            }

            $solicitacao->update($dados);

            if ($novoStatus === 'EM_ANALISE') {
                EntradaFila::query()->firstOrCreate(
                    ['solicitacao_id' => $solicitacao->id, 'encerrada_em' => null],
                    ['entrou_em' => now()]
                );
            }

            if ($novoStatus === 'AGENDADA') {
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
