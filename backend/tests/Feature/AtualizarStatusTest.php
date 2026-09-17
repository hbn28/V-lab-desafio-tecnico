<?php

use App\Models\Solicitacao;

function criarSolicitacaoViaApi($context, array $extra = []): array
{
    $payload = array_merge([
        'nome_solicitante' => 'João Teste',
        'cpf_solicitante'  => '987.654.321-00',
        'data_nascimento'  => '1990-03-20',
        'categoria'        => 'EXAME',
        'prioridade'       => 'BAIXA',
        'descricao'        => 'Exame de sangue de rotina para check-up anual.',
    ], $extra);

    $response = $context->postJson('/api/v1/solicitacoes', $payload);
    $response->assertStatus(201);
    return $response->json('data');
}

test('transição válida RECEBIDA → EM_ANALISE', function () {
    $sol = criarSolicitacaoViaApi($this);

    $response = $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'EM_ANALISE']);

    $response->assertStatus(200)
        ->assertJsonPath('data.status', 'EM_ANALISE');
});

test('transição válida EM_ANALISE → AGENDADA', function () {
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'EM_ANALISE'])->assertStatus(200);

    $response = $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'AGENDADA']);

    $response->assertStatus(200)
        ->assertJsonPath('data.status', 'AGENDADA');
});

test('transição válida AGENDADA → CONCLUIDA', function () {
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'EM_ANALISE']);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'AGENDADA']);

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
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'EM_ANALISE']);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'AGENDADA']);
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
