<?php

use App\Models\Agendamento;
use App\Models\Solicitacao;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('nao registra falta antes do horario exato', function () {
    CarbonImmutable::setTestNow('2026-09-25T09:59:00-03:00');
    $agendamento = Agendamento::factory()->create([
        'status' => 'AGENDADO',
        'modalidade' => 'HORARIO',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '10:00',
        'turno' => 'MANHA',
    ]);

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/falta")->assertStatus(422);
});

test('registra falta apos horario e mantem solicitacao AGENDADA', function () {
    CarbonImmutable::setTestNow('2026-09-25T10:01:00-03:00');
    $solicitacao = Solicitacao::factory()->create(['status' => 'AGENDADA']);
    $agendamento = Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'AGENDADO',
        'modalidade' => 'HORARIO',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '10:00',
        'turno' => 'MANHA',
    ]);

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/falta")->assertOk()
        ->assertJsonPath('data.status', 'FALTA');

    expect($solicitacao->fresh()->status)->toBe('AGENDADA');
});

test('turno so permite falta depois do fim do periodo', function () {
    CarbonImmutable::setTestNow('2026-09-25T11:59:00-03:00');
    $agendamento = Agendamento::factory()->create([
        'status' => 'AGENDADO',
        'modalidade' => 'TURNO',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => null,
        'turno' => 'MANHA',
    ]);

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/falta")->assertStatus(422);

    CarbonImmutable::setTestNow('2026-09-25T12:00:00-03:00');
    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/falta")->assertOk();
});

test('contato aceita apenas resultado fechado em agendamento com falta', function () {
    $agendamento = Agendamento::factory()->create(['status' => 'FALTA']);

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/tentativas-contato", [
        'resultado' => 'SEM_RESPOSTA',
        'observacao' => 'nao deve existir',
    ])->assertStatus(422)->assertJsonStructure(['errors' => ['observacao']]);

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/tentativas-contato", [
        'resultado' => 'SEM_RESPOSTA',
    ])->assertCreated()->assertJsonPath('data.resultado', 'SEM_RESPOSTA');
});

test('data_agendada é serializada como data pura (Y-m-d), igual à entrada', function () {
    CarbonImmutable::setTestNow('2026-09-25T10:01:00-03:00');
    $solicitacao = Solicitacao::factory()->create(['status' => 'AGENDADA']);
    $agendamento = Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'AGENDADO',
        'modalidade' => 'HORARIO',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '10:00',
        'turno' => 'MANHA',
    ]);

    $this->getJson("/api/v1/solicitacoes/{$solicitacao->id}")->assertOk()
        ->assertJsonPath('data.agendamento_ativo.data_agendada', '2026-09-25');

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/falta")->assertOk()
        ->assertJsonPath('data.data_agendada', '2026-09-25');

    $this->getJson('/api/v1/faltas')->assertOk()
        ->assertJsonPath('data.0.data_agendada', '2026-09-25');
});
