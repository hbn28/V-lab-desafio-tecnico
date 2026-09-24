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

test('GET fila aplica filtros de prioridade e categoria', function () {
    $urgente = Solicitacao::factory()->create([
        'status' => 'EM_ANALISE', 'prioridade' => 'URGENTE', 'categoria' => 'EXAME',
    ]);
    $urgenteOutraCategoria = Solicitacao::factory()->create([
        'status' => 'EM_ANALISE', 'prioridade' => 'URGENTE', 'categoria' => 'CONSULTA',
    ]);
    foreach ([$urgente, $urgenteOutraCategoria] as $solicitacao) {
        EntradaFila::factory()->create(['solicitacao_id' => $solicitacao->id]);
    }

    $this->getJson('/api/v1/fila?prioridade=URGENTE&categoria=EXAME')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.solicitacao.id', $urgente->id);
});

test('GET fila não expõe dados pessoais completos nas entradas', function () {
    $solicitacao = Solicitacao::factory()->create([
        'status' => 'EM_ANALISE', 'cpf_solicitante' => '123.456.789-00',
    ]);
    EntradaFila::factory()->create(['solicitacao_id' => $solicitacao->id]);

    $this->getJson('/api/v1/fila')
        ->assertOk()
        ->assertJsonMissingPath('data.0.solicitacao.data_nascimento')
        ->assertJsonPath('data.0.solicitacao.cpf_solicitante', '***.456.789-**');
});
