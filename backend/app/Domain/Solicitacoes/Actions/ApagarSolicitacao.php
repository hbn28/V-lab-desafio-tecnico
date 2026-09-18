<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Solicitacao;
use Illuminate\Support\Facades\DB;

class ApagarSolicitacao
{
    public function execute(Solicitacao $solicitacao): void
    {
        DB::transaction(function () use ($solicitacao) {
            $solicitacao = Solicitacao::lockForUpdate()->findOrFail($solicitacao->id);
            $solicitacao->delete();
        });
    }
}
