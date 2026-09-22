<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Agendamento;
use App\Models\TentativaContato;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class RegistrarTentativaContato
{
    public function execute(Agendamento $agendamento, string $resultado): TentativaContato
    {
        return DB::transaction(function () use ($agendamento, $resultado) {
            $agendamento = Agendamento::query()->whereKey($agendamento->id)->lockForUpdate()->firstOrFail();

            if ($agendamento->status !== 'FALTA') {
                $this->conflito('Tentativas de contato só podem ser registradas após falta.');
            }

            return $agendamento->tentativasContato()->create([
                'resultado' => $resultado,
                'realizada_em' => now(),
            ]);
        });
    }

    private function conflito(string $mensagem): never
    {
        throw new HttpResponseException(
            response()->json(['message' => $mensagem, 'errors' => []], 409)
        );
    }
}
