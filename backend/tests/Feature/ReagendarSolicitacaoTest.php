<?php

use App\Domain\Solicitacoes\Actions\ReagendarSolicitacao;
use App\Models\Solicitacao;
use Carbon\CarbonImmutable;

afterEach(function () {
    CarbonImmutable::setTestNow();
});

test('reagenda somente uma solicitação AGENDADA', function () {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $solicitacao = Solicitacao::factory()->create([
        'status' => 'AGENDADA',
        'agendado_para' => '2026-09-25T17:30:00Z',
    ]);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/agendamento", [
        'data_agendada' => '2026-09-28',
        'hora_agendada' => '09:00',
    ])->assertOk()
        ->assertJsonPath('data.status', 'AGENDADA')
        ->assertJsonPath('data.agendado_para', '2026-09-28T12:00:00+00:00');
});

test('reagendamento em estado incompatível retorna 409', function () {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $solicitacao = Solicitacao::factory()->create(['status' => 'EM_ANALISE']);
    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/agendamento", [
        'data_agendada' => '2026-09-28',
        'hora_agendada' => '09:00',
    ])->assertStatus(409)->assertJsonStructure(['message', 'errors']);
});

test('reagendamento valida payload estritamente', function (array $payload, string $campo) {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $solicitacao = Solicitacao::factory()->create([
        'status' => 'AGENDADA', 'agendado_para' => '2026-09-25T17:30:00Z',
    ]);
    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/agendamento", $payload)
        ->assertStatus(422)->assertJsonStructure(['errors' => [$campo]]);
})->with([
    [['data_agendada' => '2026-09-28'], 'hora_agendada'],
    [['hora_agendada' => '09:00'], 'data_agendada'],
    [['data_agendada' => '2026-09-20', 'hora_agendada' => '09:00'], 'data_agendada'],
    [['data_agendada' => '2026-09-28', 'hora_agendada' => '09:00', 'sala' => 2], 'sala'],
]);

test('reagendar para o mesmo instante não altera updated_at', function () {
    $solicitacao = Solicitacao::factory()->create([
        'status' => 'AGENDADA', 'agendado_para' => '2026-09-25T17:30:00Z',
        'updated_at' => '2026-09-21T15:00:00Z',
    ]);
    CarbonImmutable::setTestNow('2026-09-22T15:00:00Z');
    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/agendamento", [
        'data_agendada' => '2026-09-25', 'hora_agendada' => '14:30',
    ])->assertOk();
    expect($solicitacao->fresh()->updated_at->toIso8601String())->toBe('2026-09-21T15:00:00+00:00');
});

test('chamadores obsoletos são serializados e o último valor válido vence', function () {
    $solicitacao = Solicitacao::factory()->create([
        'status' => 'AGENDADA', 'agendado_para' => '2026-09-25T17:30:00Z',
    ]);
    $primeira = Solicitacao::findOrFail($solicitacao->id);
    $segunda = Solicitacao::findOrFail($solicitacao->id);
    $action = app(ReagendarSolicitacao::class);
    $action->execute($primeira, CarbonImmutable::parse('2026-09-28T12:00:00Z'));
    $action->execute($segunda, CarbonImmutable::parse('2026-09-29T13:00:00Z'));
    expect($solicitacao->fresh()->agendado_para->toIso8601String())->toBe('2026-09-29T13:00:00+00:00');
});

test('reagendamento inexistente retorna 404', function () {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $this->patchJson('/api/v1/solicitacoes/999999/agendamento', [
        'data_agendada' => '2026-09-28', 'hora_agendada' => '09:00',
    ])->assertStatus(404);
});

test('duas solicitações podem terminar no mesmo horário', function () {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $solicitacoes = Solicitacao::factory()->count(2)->create([
        'status' => 'AGENDADA', 'agendado_para' => '2026-09-25T17:30:00Z',
    ]);
    foreach ($solicitacoes as $solicitacao) {
        $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/agendamento", [
            'data_agendada' => '2026-09-28', 'hora_agendada' => '09:00',
        ])->assertOk();
    }
    expect(Solicitacao::where('agendado_para', '2026-09-28T12:00:00Z')->count())->toBe(2);
});
