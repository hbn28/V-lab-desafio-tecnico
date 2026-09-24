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

test('seeder não altera solicitações de exemplo que já existiam no banco', function () {
    $this->seed();

    $agendada = Solicitacao::where('protocolo', 'SOL-2025-0003')->firstOrFail();
    Agendamento::where('solicitacao_id', $agendada->id)->update(['status' => 'FALTA', 'falta_registrada_em' => now()]);
    $emAnalise = Solicitacao::where('protocolo', 'SOL-2025-0002')->firstOrFail();
    EntradaFila::where('solicitacao_id', $emAnalise->id)->update(['encerrada_em' => now(), 'motivo_encerramento' => 'CANCELAMENTO']);

    $antes = [Agendamento::count(), EntradaFila::count(), Solicitacao::max('updated_at')];
    $this->seed();

    expect([Agendamento::count(), EntradaFila::count(), Solicitacao::max('updated_at')])->toBe($antes)
        ->and(Agendamento::where('solicitacao_id', $agendada->id)->where('status', 'AGENDADO')->exists())->toBeFalse();
});
