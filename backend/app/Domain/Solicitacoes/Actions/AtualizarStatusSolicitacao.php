<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Solicitacao;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class AtualizarStatusSolicitacao
{
    /** @var array<string, string[]> */
    private const TRANSICOES = [
        'RECEBIDA'   => ['EM_ANALISE', 'CANCELADA'],
        'EM_ANALISE' => ['AGENDADA', 'CANCELADA'],
        'AGENDADA'   => ['CONCLUIDA', 'CANCELADA'],
        'CONCLUIDA'  => [],
        'CANCELADA'  => [],
    ];

    public function execute(Solicitacao $solicitacao, string $novoStatus): Solicitacao
    {
        return DB::transaction(function () use ($solicitacao, $novoStatus) {
            // Relê com lock para evitar race condition
            $solicitacao = Solicitacao::lockForUpdate()->findOrFail($solicitacao->id);

            $permitidos = self::TRANSICOES[$solicitacao->status] ?? [];

            if (!in_array($novoStatus, $permitidos, true)) {
                $this->conflito(
                    "Transição de '{$solicitacao->status}' para '{$novoStatus}' não é permitida."
                );
            }

            $solicitacao->update(['status' => $novoStatus]);

            return $solicitacao->fresh();
        });
    }

    private function conflito(string $mensagem): never
    {
        throw new HttpResponseException(
            response()->json(['message' => $mensagem, 'errors' => []], 409)
        );
    }
}
