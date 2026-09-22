<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Agendamento;
use App\Models\Solicitacao;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

/**
 * Cria um novo agendamento ativo após uma falta, sem apagar o registro da
 * falta anterior: a aba de faltas preserva o ocorrido e a agenda passa a
 * exibir apenas o novo horário.
 */
class ReagendarAposFalta
{
    /**
     * @param  array{modalidade:string,data_agendada:string,hora_agendada:?string,turno:string,agendado_para:?\Carbon\CarbonImmutable}  $dadosAgendamento
     */
    public function execute(Agendamento $agendamento, array $dadosAgendamento): Agendamento
    {
        return DB::transaction(function () use ($agendamento, $dadosAgendamento) {
            $falta = Agendamento::query()->whereKey($agendamento->id)->lockForUpdate()->firstOrFail();

            if ($falta->status !== 'FALTA') {
                $this->conflito('Somente faltas podem ser reagendadas por esta rota.');
            }

            $solicitacao = Solicitacao::query()->whereKey($falta->solicitacao_id)->lockForUpdate()->firstOrFail();

            if ($solicitacao->status !== 'AGENDADA') {
                $this->conflito('A solicitação precisa permanecer agendada para receber novo agendamento.');
            }

            $existeAtivo = Agendamento::query()
                ->where('solicitacao_id', $solicitacao->id)
                ->where('status', 'AGENDADO')
                ->lockForUpdate()
                ->exists();

            if ($existeAtivo) {
                $this->conflito('Já existe um agendamento ativo para esta solicitação.');
            }

            $novo = Agendamento::query()->create([
                'solicitacao_id' => $solicitacao->id,
                'data_agendada' => $dadosAgendamento['data_agendada'],
                'modalidade' => $dadosAgendamento['modalidade'],
                'hora_agendada' => $dadosAgendamento['hora_agendada'],
                'turno' => $dadosAgendamento['turno'],
                'status' => 'AGENDADO',
            ]);

            $solicitacao->update(['agendado_para' => $dadosAgendamento['agendado_para']]);

            return $novo;
        });
    }

    private function conflito(string $mensagem): never
    {
        throw new HttpResponseException(
            response()->json(['message' => $mensagem, 'errors' => []], 409)
        );
    }
}
