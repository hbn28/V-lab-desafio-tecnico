<?php

use App\Models\EntradaFila;
use App\Models\Solicitacao;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('RECEBIDA para EM_ANALISE abre entrada de fila uma unica vez', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'RECEBIDA']);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", ['status' => 'EM_ANALISE'])->assertOk();

    expect(EntradaFila::where('solicitacao_id', $solicitacao->id)->whereNull('encerrada_em')->count())->toBe(1);
});

test('agendar encerra entrada de fila com motivo AGENDAMENTO', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'EM_ANALISE']);
    EntradaFila::factory()->create(['solicitacao_id' => $solicitacao->id, 'entrou_em' => now()->subDay()]);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", [
        'status' => 'AGENDADA',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '07:00',
    ])->assertOk();

    $entrada = EntradaFila::where('solicitacao_id', $solicitacao->id)->first();
    expect($entrada->encerrada_em)->not->toBeNull()
        ->and($entrada->motivo_encerramento)->toBe('AGENDAMENTO');
});

test('GET fila lista apenas entradas abertas por prioridade e entrada mais antiga', function () {
    $baixa = Solicitacao::factory()->create(['status' => 'EM_ANALISE', 'prioridade' => 'BAIXA']);
    $urgenteNova = Solicitacao::factory()->create(['status' => 'EM_ANALISE', 'prioridade' => 'URGENTE']);
    $urgenteAntiga = Solicitacao::factory()->create(['status' => 'EM_ANALISE', 'prioridade' => 'URGENTE']);
    EntradaFila::factory()->create(['solicitacao_id' => $baixa->id, 'entrou_em' => now()->subDays(5)]);
    EntradaFila::factory()->create(['solicitacao_id' => $urgenteNova->id, 'entrou_em' => now()->subHour()]);
    EntradaFila::factory()->create(['solicitacao_id' => $urgenteAntiga->id, 'entrou_em' => now()->subHours(3)]);

    $this->getJson('/api/v1/fila')->assertOk()
        ->assertJsonPath('data.0.solicitacao.id', $urgenteAntiga->id)
        ->assertJsonPath('data.1.solicitacao.id', $urgenteNova->id)
        ->assertJsonPath('data.2.solicitacao.id', $baixa->id);
});
