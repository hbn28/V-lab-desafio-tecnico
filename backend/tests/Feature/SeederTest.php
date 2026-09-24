<?php

use App\Models\Agendamento;
use App\Models\EntradaFila;
use App\Models\Solicitacao;

test('seeder é idempotente e deixa fila e agenda coerentes com o fluxo real', function () {
    $this->seed();
    $this->seed();

    expect(Solicitacao::count())->toBe(10)
        ->and(EntradaFila::whereNull('encerrada_em')->count())->toBe(Solicitacao::where('status', 'EM_ANALISE')->count())
        ->and(Agendamento::where('status', 'AGENDADO')->count())->toBe(Solicitacao::where('status', 'AGENDADA')->count());

    $this->getJson('/api/v1/fila')->assertOk()->assertJsonCount(2, 'data');
});
