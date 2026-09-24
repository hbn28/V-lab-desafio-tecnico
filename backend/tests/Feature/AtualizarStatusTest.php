<?php

use App\Domain\Solicitacoes\Actions\AtualizarStatusSolicitacao;
use App\Domain\Solicitacoes\Exceptions\ConflitoDeEstado;
use App\Models\Solicitacao;
use Carbon\CarbonImmutable;

afterEach(function () {
    CarbonImmutable::setTestNow();
});

function criarSolicitacaoViaApi($context, array $extra = []): array
{
    $payload = array_merge([
        'nome_solicitante' => 'João Teste',
        'cpf_solicitante' => '987.654.321-00',
        'data_nascimento' => '1990-03-20',
        'categoria' => 'EXAME',
        'prioridade' => 'BAIXA',
        'descricao' => 'Exame de sangue de rotina para check-up anual.',
    ], $extra);

    $response = $context->postJson('/api/v1/solicitacoes', $payload);
    $response->assertStatus(201);

    return $response->json('data');
}

function agendarViaApi($context, int $id): void
{
    $context->patchJson("/api/v1/solicitacoes/{$id}/status", ['status' => 'EM_ANALISE'])->assertStatus(200);
    $context->patchJson("/api/v1/solicitacoes/{$id}/status", [
        'status' => 'AGENDADA',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '14:30',
    ])->assertStatus(200);
}

test('transição válida RECEBIDA → EM_ANALISE', function () {
    $sol = criarSolicitacaoViaApi($this);

    $response = $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'EM_ANALISE']);

    $response->assertStatus(200)
        ->assertJsonPath('data.status', 'EM_ANALISE');
});

test('transição EM_ANALISE para AGENDADA exige e persiste data e hora', function () {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'EM_ANALISE'])->assertOk();

    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", [
        'status' => 'AGENDADA',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '14:30',
    ])->assertOk()
        ->assertJsonPath('data.status', 'AGENDADA')
        ->assertJsonPath('data.agendado_para', '2026-09-25T17:30:00+00:00');
});

test('rejeita AGENDADA sem ambos os campos, no passado ou com campo desconhecido', function (array $payload, string $campo) {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'EM_ANALISE']);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", $payload)
        ->assertStatus(422)->assertJsonStructure(['message', 'errors' => [$campo]]);
})->with([
    [['status' => 'AGENDADA', 'data_agendada' => '2026-09-25'], 'hora_agendada'],
    [['status' => 'AGENDADA', 'hora_agendada' => '14:30'], 'data_agendada'],
    [['status' => 'AGENDADA', 'data_agendada' => '2026-09-20', 'hora_agendada' => '14:30'], 'data_agendada'],
    [['status' => 'AGENDADA', 'data_agendada' => '2026-09-25', 'hora_agendada' => '14:30', 'duracao' => 30], 'duracao'],
]);

test('campos de agenda são proibidos em outro destino', function () {
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", [
        'status' => 'EM_ANALISE',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '14:30',
    ])->assertStatus(422)->assertJsonStructure(['errors' => ['data_agendada', 'hora_agendada']]);
});

test('aceita hoje quando o horário ainda é futuro', function () {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'EM_ANALISE']);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", [
        'status' => 'AGENDADA', 'data_agendada' => '2026-09-21', 'hora_agendada' => '13:00',
    ])->assertOk();
});

test('RECEBIDA para AGENDADA continua inválida com payload completo', function () {
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", [
        'status' => 'AGENDADA', 'data_agendada' => '2026-09-25', 'hora_agendada' => '14:30',
    ])->assertStatus(409);
});

test('concluir e cancelar preservam o horário histórico', function (string $destino) {
    $solicitacao = Solicitacao::factory()->create([
        'status' => 'AGENDADA', 'agendado_para' => '2026-09-25T17:30:00Z',
    ]);
    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", ['status' => $destino])
        ->assertOk()->assertJsonPath('data.agendado_para', '2026-09-25T17:30:00+00:00');
})->with(['CONCLUIDA', 'CANCELADA']);

test('instância obsoleta é relida sob lock e recebe 409 após outro agendamento', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'EM_ANALISE']);
    $primeira = Solicitacao::findOrFail($solicitacao->id);
    $segunda = Solicitacao::findOrFail($solicitacao->id);
    $action = app(AtualizarStatusSolicitacao::class);

    $action->execute($primeira, 'AGENDADA', [
        'modalidade' => 'HORARIO',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '14:30',
        'turno' => 'TARDE',
        'agendado_para' => CarbonImmutable::parse('2026-09-25T17:30:00Z'),
    ]);

    expect(fn () => $action->execute($segunda, 'AGENDADA', [
        'modalidade' => 'HORARIO',
        'data_agendada' => '2026-09-26',
        'hora_agendada' => '14:30',
        'turno' => 'TARDE',
        'agendado_para' => CarbonImmutable::parse('2026-09-26T17:30:00Z'),
    ]))->toThrow(ConflitoDeEstado::class, "Transição de 'AGENDADA' para 'AGENDADA' não é permitida.");
    expect($solicitacao->fresh()->agendado_para->toIso8601String())->toBe('2026-09-25T17:30:00+00:00');
});

test('transição válida AGENDADA → CONCLUIDA', function () {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $sol = criarSolicitacaoViaApi($this);
    agendarViaApi($this, $sol['id']);

    $response = $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'CONCLUIDA']);

    $response->assertStatus(200)
        ->assertJsonPath('data.status', 'CONCLUIDA');
});

test('transição inválida retorna 409', function () {
    $sol = criarSolicitacaoViaApi($this);
    // RECEBIDA → CONCLUIDA é inválida
    $response = $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'CONCLUIDA']);

    $response->assertStatus(409)
        ->assertJsonStructure(['message']);
});

test('não pode transicionar de CONCLUIDA', function () {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $sol = criarSolicitacaoViaApi($this);
    agendarViaApi($this, $sol['id']);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'CONCLUIDA']);

    $response = $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'CANCELADA']);

    $response->assertStatus(409);
});

test('cancelar via RECEBIDA → CANCELADA', function () {
    $sol = criarSolicitacaoViaApi($this);

    $response = $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'CANCELADA']);

    $response->assertStatus(200)
        ->assertJsonPath('data.status', 'CANCELADA');
});

test('status inválido retorna 422', function () {
    $sol = criarSolicitacaoViaApi($this);

    $response = $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'INEXISTENTE']);

    $response->assertStatus(422);
});

test('solicitação inexistente retorna 404', function () {
    $response = $this->patchJson('/api/v1/solicitacoes/99999/status', ['status' => 'EM_ANALISE']);

    $response->assertStatus(404);
});
