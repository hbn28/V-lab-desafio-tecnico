<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Domain\Solicitacoes\Exceptions\ConflitoDeEstado;
use App\Models\Agendamento;
use App\Models\TentativaContato;
use Illuminate\Support\Facades\DB;

class RegistrarTentativaContato
{
    public function execute(Agendamento $agendamento, string $resultado): TentativaContato
    {
        return DB::transaction(function () use ($agendamento, $resultado) {
            $agendamento = Agendamento::query()->whereKey($agendamento->id)->lockForUpdate()->firstOrFail();

            if ($agendamento->status !== 'FALTA') {
                throw new ConflitoDeEstado('Tentativas de contato só podem ser registradas após falta.');
            }

            return $agendamento->tentativasContato()->create([
                'resultado' => $resultado,
                'realizada_em' => now(),
            ]);
        });
    }
}
