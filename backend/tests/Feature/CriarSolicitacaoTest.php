<?php

use App\Models\Solicitacao;

beforeEach(function () {
    // Garantir que a tabela de counters existe
    \Illuminate\Support\Facades\DB::statement('
        CREATE TABLE IF NOT EXISTS protocolo_counters (
            ano INT PRIMARY KEY,
            ultimo_numero INT NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0)
        )
    ');
});

function payloadValido(): array
{
    return [
        'nome_solicitante' => 'Maria Silva',
        'cpf_solicitante'  => '123.456.789-00',
        'data_nascimento'  => '1985-06-15',
        'categoria'        => 'CONSULTA',
        'prioridade'       => 'MEDIA',
        'descricao'        => 'Consulta de rotina para verificação de pressão arterial.',
    ];
}

test('cria solicitação com dados válidos', function () {
    $response = $this->postJson('/api/v1/solicitacoes', payloadValido());

    $response->assertStatus(201)
        ->assertJsonPath('data.status', 'RECEBIDA')
        ->assertJsonPath('data.categoria', 'CONSULTA')
        ->assertJsonPath('data.nome_solicitante', 'Maria Silva');

    expect($response->json('data.protocolo'))->toMatch('/^SOL-\d{4}-\d{4}$/');
});

test('rejeita URGENTE sem justificativa', function () {
    $payload = payloadValido();
    $payload['prioridade'] = 'URGENTE';

    $response = $this->postJson('/api/v1/solicitacoes', $payload);

    $response->assertStatus(422)
        ->assertJsonPath('errors.justificativa_prioridade.0', fn($v) => str_contains($v, 'justificativa'));
});

test('aceita URGENTE com justificativa preenchida', function () {
    $payload = payloadValido();
    $payload['prioridade'] = 'URGENTE';
    $payload['justificativa_prioridade'] = 'Risco imediato de vida detectado no exame anterior.';

    $response = $this->postJson('/api/v1/solicitacoes', $payload);

    $response->assertStatus(201)
        ->assertJsonPath('data.prioridade', 'URGENTE');
});

test('rejeita campos proibidos como protocolo e status', function () {
    $payload = payloadValido();
    $payload['protocolo'] = 'SOL-2025-9999';
    $payload['status']    = 'CONCLUIDA';

    $response = $this->postJson('/api/v1/solicitacoes', $payload);

    $response->assertStatus(422);
});

test('rejeita descricao vazia', function () {
    $payload = payloadValido();
    $payload['descricao'] = '';

    $response = $this->postJson('/api/v1/solicitacoes', $payload);

    $response->assertStatus(422)
        ->assertJsonStructure(['message', 'errors' => ['descricao']]);
});

test('dois protocolos gerados são únicos e sequenciais', function () {
    $r1 = $this->postJson('/api/v1/solicitacoes', payloadValido());
    $r2 = $this->postJson('/api/v1/solicitacoes', payloadValido());

    $r1->assertStatus(201);
    $r2->assertStatus(201);

    expect($r1->json('data.protocolo'))->not->toBe($r2->json('data.protocolo'));

    $num1 = (int) substr($r1->json('data.protocolo'), -4);
    $num2 = (int) substr($r2->json('data.protocolo'), -4);
    expect($num2)->toBe($num1 + 1);
});
