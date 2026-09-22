<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Solicitacao;
use Carbon\CarbonImmutable;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

/**
 * Altera somente agendado_para de uma solicitação já AGENDADA.
 * Nunca muda o status: AtualizarStatusSolicitacao segue como única autoridade de transições.
 */
class ReagendarSolicitacao
{
    public function execute(Solicitacao $solicitacao, CarbonImmutable $agendadoPara): Solicitacao
    {
        return DB::transaction(function () use ($solicitacao, $agendadoPara) {
            $solicitacao = Solicitacao::lockForUpdate()->findOrFail($solicitacao->id);

            if ($solicitacao->status !== 'AGENDADA') {
                throw new HttpResponseException(response()->json([
                    'message' => 'Somente solicitações agendadas podem ser reagendadas.',
                    'errors' => [],
                ], 409));
            }

            if ($solicitacao->agendado_para?->equalTo($agendadoPara)) {
                return $solicitacao;
            }

            $solicitacao->update(['agendado_para' => $agendadoPara]);

            return $solicitacao->fresh();
        });
    }
}
