<?php

use App\Models\Agendamento;
use App\Models\Solicitacao;
use App\Models\TentativaContato;

test('lista falta historica com o agendamento ativo da mesma solicitacao', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'AGENDADA']);
    Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id, 'status' => 'FALTA',
        'data_agendada' => '2026-09-22', 'falta_registrada_em' => now()->subDay(),
    ]);
    $ativo = Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id, 'status' => 'AGENDADO',
        'data_agendada' => '2026-09-30',
    ]);

    $this->getJson('/api/v1/faltas')->assertOk()
        ->assertJsonPath('data.0.solicitacao.agendamento_ativo.id', $ativo->id);
});

test('filtra faltas por busca, prioridade e período mantendo paginação no servidor', function () {
    $urgente = Solicitacao::factory()->create([
        'nome_solicitante' => 'João da Silva',
        'protocolo' => 'SOL-2026-0601',
        'prioridade' => 'URGENTE',
    ]);
    $baixa = Solicitacao::factory()->create([
        'nome_solicitante' => 'Maria Santos',
        'protocolo' => 'SOL-2026-0602',
        'prioridade' => 'BAIXA',
    ]);
    $faltaUrgente = Agendamento::factory()->create([
        'solicitacao_id' => $urgente->id,
        'status' => 'FALTA',
        'data_agendada' => '2026-09-22',
        'falta_registrada_em' => '2026-09-22 10:00:00+00',
    ]);
    Agendamento::factory()->create([
        'solicitacao_id' => $baixa->id,
        'status' => 'FALTA',
        'data_agendada' => '2026-09-23',
        'falta_registrada_em' => '2026-09-23 10:00:00+00',
    ]);

    $this->getJson('/api/v1/faltas?q=Jo%C3%A3o&prioridade=URGENTE&data_de=2026-09-22&data_ate=2026-09-22&per_page=1')
        ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $faltaUrgente->id);
});

test('serializa a data da falta como data ISO sem horário', function () {
    $solicitacao = Solicitacao::factory()->create();
    $falta = Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'FALTA',
        'modalidade' => 'HORARIO',
        'data_agendada' => '2026-09-30',
        'hora_agendada' => '10:30',
        'turno' => 'MANHA',
        'falta_registrada_em' => '2026-09-30 12:00:00+00',
    ]);

    $this->getJson('/api/v1/faltas')
        ->assertOk()
        ->assertJsonPath('data.0.id', $falta->id)
        ->assertJsonPath('data.0.data_agendada', '2026-09-30');
});

test('faltas usam prioridade como padrão e horário/data como escolhas válidas', function () {
    $baixa = Solicitacao::factory()->create(['prioridade' => 'BAIXA']);
    $urgente = Solicitacao::factory()->create(['prioridade' => 'URGENTE']);
    $faltaBaixa = Agendamento::factory()->create([
        'solicitacao_id' => $baixa->id, 'status' => 'FALTA', 'modalidade' => 'HORARIO',
        'data_agendada' => '2026-09-22', 'hora_agendada' => '08:00', 'turno' => 'MANHA', 'falta_registrada_em' => now(),
    ]);
    $faltaUrgente = Agendamento::factory()->create([
        'solicitacao_id' => $urgente->id, 'status' => 'FALTA', 'modalidade' => 'HORARIO',
        'data_agendada' => '2026-09-22', 'hora_agendada' => '11:00', 'turno' => 'MANHA', 'falta_registrada_em' => now(),
    ]);

    $this->getJson('/api/v1/faltas')->assertOk()
        ->assertJsonPath('data.0.id', $faltaUrgente->id);
    $this->getJson('/api/v1/faltas?ordenar_por=horario')->assertOk()
        ->assertJsonPath('data.0.id', $faltaBaixa->id);
    $this->getJson('/api/v1/faltas?ordenar_por=horario&direcao=desc')->assertOk()
        ->assertJsonPath('data.0.id', $faltaUrgente->id);
    $this->getJson('/api/v1/faltas?ordenar_por=prioridade&direcao=desc')->assertOk()
        ->assertJsonPath('data.0.id', $faltaUrgente->id);
});

test('faltas filtram pelo resultado do contato e rejeitam ordenação inválida', function () {
    $agendamento = Agendamento::factory()->create([
        'status' => 'FALTA', 'data_agendada' => '2026-09-22', 'falta_registrada_em' => now(),
    ]);
    TentativaContato::factory()->create([
        'agendamento_id' => $agendamento->id,
        'resultado' => 'SEM_RESPOSTA',
    ]);

    $this->getJson('/api/v1/faltas?resultado_contato=SEM_RESPOSTA')
        ->assertOk()->assertJsonPath('meta.total', 1);
    $this->getJson('/api/v1/faltas?ordenar_por=desconhecido')
        ->assertUnprocessable()->assertJsonStructure(['message', 'errors' => ['ordenar_por']]);
});
