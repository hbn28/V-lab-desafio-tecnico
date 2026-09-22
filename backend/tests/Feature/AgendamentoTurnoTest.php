<?php

use App\Domain\Solicitacoes\Support\TurnoAgendamento;
use App\Models\Agendamento;
use App\Models\Solicitacao;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('banco permite apenas um agendamento ativo por solicitacao', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'AGENDADA']);

    Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'AGENDADO',
        'modalidade' => 'TURNO',
        'data_agendada' => '2026-09-25',
        'turno' => 'MANHA',
        'hora_agendada' => null,
    ]);

    expect(fn () => Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'AGENDADO',
        'modalidade' => 'TURNO',
        'data_agendada' => '2026-09-26',
        'turno' => 'TARDE',
        'hora_agendada' => null,
    ]))->toThrow(QueryException::class);
});

test('check rejeita combinacao ambigua de modalidade e hora', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'AGENDADA']);

    expect(fn () => Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'AGENDADO',
        'modalidade' => 'TURNO',
        'data_agendada' => '2026-09-25',
        'turno' => 'MANHA',
        'hora_agendada' => '07:00',
    ]))->toThrow(QueryException::class);
});

test('horario deriva turno automaticamente', function (string $hora, string $turno) {
    expect(TurnoAgendamento::derivarDaHora($hora))->toBe($turno);
})->with([
    ['07:00', 'MANHA'],
    ['14:00', 'TARDE'],
    ['19:00', 'NOITE'],
    ['05:59', 'NOITE'],
]);

test('AGENDADA aceita turno sem hora e mantem agendado_para nulo', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'EM_ANALISE']);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", [
        'status' => 'AGENDADA',
        'data_agendada' => '2026-09-25',
        'turno' => 'MANHA',
    ])->assertOk()
        ->assertJsonPath('data.status', 'AGENDADA')
        ->assertJsonPath('data.agendado_para', null)
        ->assertJsonPath('data.agendamento_ativo.modalidade', 'TURNO')
        ->assertJsonPath('data.agendamento_ativo.turno', 'MANHA');
});

test('payload ambiguo de agenda retorna 422', function (array $payload, string $campo) {
    $solicitacao = Solicitacao::factory()->create(['status' => 'EM_ANALISE']);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", $payload)
        ->assertStatus(422)
        ->assertJsonStructure(['message', 'errors' => [$campo]]);
})->with([
    [['status' => 'AGENDADA', 'data_agendada' => '2026-09-25'], 'hora_agendada'],
    [['status' => 'AGENDADA', 'data_agendada' => '2026-09-25', 'hora_agendada' => '07:00', 'turno' => 'MANHA'], 'turno'],
]);
