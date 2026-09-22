<?php

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
