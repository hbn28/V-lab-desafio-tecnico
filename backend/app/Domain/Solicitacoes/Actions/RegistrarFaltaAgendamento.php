<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Domain\Solicitacoes\Support\HorarioAgendamento;
use App\Domain\Solicitacoes\Support\TurnoAgendamento;
use App\Models\Agendamento;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RegistrarFaltaAgendamento
{
    public function execute(Agendamento $agendamento): Agendamento
    {
        return DB::transaction(function () use ($agendamento) {
            $agendamento = Agendamento::query()->whereKey($agendamento->id)->lockForUpdate()->firstOrFail();

            if ($agendamento->status !== 'AGENDADO') {
                $this->conflito('Somente agendamentos ativos podem receber falta.');
            }

            $timezone = config('agendamento.timezone');

            $limite = $agendamento->modalidade === 'HORARIO'
                ? HorarioAgendamento::interpretarLocal($agendamento->data_agendada->toDateString(), substr($agendamento->hora_agendada, 0, 5), $timezone)
                : TurnoAgendamento::fimDoTurnoUtc($agendamento->data_agendada->toDateString(), $agendamento->turno, $timezone);

            if (now()->lt($limite)) {
                throw ValidationException::withMessages([
                    'agendamento' => ['A falta só pode ser registrada após o horário ou fim do turno.'],
                ]);
            }

            $agendamento->update(['status' => 'FALTA', 'falta_registrada_em' => now()]);

            return $agendamento->fresh();
        });
    }

    private function conflito(string $mensagem): never
    {
        throw new HttpResponseException(
            response()->json(['message' => $mensagem, 'errors' => []], 409)
        );
    }
}
