<?php

use App\Models\Agendamento;
use App\Models\Solicitacao;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('reagendar apos falta cria novo ativo e preserva falta antiga', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'AGENDADA']);
    $falta = Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'FALTA',
        'modalidade' => 'TURNO',
        'data_agendada' => '2026-09-25',
        'turno' => 'MANHA',
        'hora_agendada' => null,
        'falta_registrada_em' => now(),
    ]);

    $this->postJson("/api/v1/agendamentos/{$falta->id}/reagendar-apos-falta", [
        'data_agendada' => '2026-09-30',
        'hora_agendada' => '14:00',
    ])->assertCreated()
        ->assertJsonPath('data.status', 'AGENDADO')
        ->assertJsonPath('data.turno', 'TARDE');

    expect($falta->fresh()->status)->toBe('FALTA')
        ->and(Agendamento::where('solicitacao_id', $solicitacao->id)->where('status', 'AGENDADO')->count())->toBe(1);
});

test('nao reagenda agendamento que nao esta em falta', function () {
    $agendamento = Agendamento::factory()->create(['status' => 'AGENDADO']);

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/reagendar-apos-falta", [
        'data_agendada' => '2026-09-30',
        'turno' => 'TARDE',
    ])->assertStatus(409);
});

test('concluir depois de falta preserva registro e preenche correcao', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'AGENDADA']);
    $falta = Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'FALTA',
        'falta_registrada_em' => now()->subHour(),
    ]);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", ['status' => 'CONCLUIDA'])->assertOk();

    expect($falta->fresh()->status)->toBe('REALIZADO')
        ->and($falta->fresh()->falta_registrada_em)->not->toBeNull()
        ->and($falta->fresh()->falta_corrigida_em)->not->toBeNull();
});
