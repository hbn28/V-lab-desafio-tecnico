<?php

use App\Models\Paciente;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    // Garantir que a tabela de counters existe
    DB::statement('
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
        'cpf_solicitante' => '123.456.789-00',
        'data_nascimento' => '1985-06-15',
        'categoria' => 'CONSULTA',
        'prioridade' => 'MEDIA',
        'descricao' => 'Consulta de rotina para verificação de pressão arterial.',
    ];
}

test('cria solicitação com dados válidos', function () {
    $response = $this->postJson('/api/v1/solicitacoes', payloadValido());

    $response->assertStatus(201)
        ->assertJsonPath('data.status', 'RECEBIDA')
        ->assertJsonPath('data.categoria', 'CONSULTA')
        ->assertJsonPath('data.nome_solicitante', 'Maria Silva')
        ->assertJsonPath('data.agendado_para', null)
        ->assertJsonPath('data.paciente.celular_mascarado', null);

    $this->assertDatabaseHas('solicitacoes', ['id' => $response->json('data.id'), 'agendado_para' => null]);
    expect($response->json('data.protocolo'))->toMatch('/^SOL-\d{4}-\d{4}$/');
    expect($response->json('data.paciente.id'))->not->toBeNull();
});

test('duas solicitacoes com mesmo cpf reaproveitam o mesmo paciente', function () {
    $r1 = $this->postJson('/api/v1/solicitacoes', payloadValido());
    $r2 = $this->postJson('/api/v1/solicitacoes', payloadValido());

    $r1->assertStatus(201);
    $r2->assertStatus(201);
    expect($r1->json('data.paciente.id'))->toBe($r2->json('data.paciente.id'));
    expect(Paciente::count())->toBe(1);
});

test('rejeita URGENTE sem justificativa', function () {
    $payload = payloadValido();
    $payload['prioridade'] = 'URGENTE';

    $response = $this->postJson('/api/v1/solicitacoes', $payload);

    $response->assertStatus(422)
        ->assertJsonPath('errors.justificativa_prioridade.0', fn ($v) => str_contains($v, 'justificativa'));
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
    $payload['status'] = 'CONCLUIDA';

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

test('rejeita cpf em formato inválido', function () {
    $payload = payloadValido();
    $payload['cpf_solicitante'] = '12345678900'; // sem pontuação

    $response = $this->postJson('/api/v1/solicitacoes', $payload);

    $response->assertStatus(422)
        ->assertJsonStructure(['message', 'errors' => ['cpf_solicitante']]);
});

test('rejeita data de nascimento no futuro', function () {
    $payload = payloadValido();
    $payload['data_nascimento'] = date('Y-m-d', strtotime('+1 year'));

    $response = $this->postJson('/api/v1/solicitacoes', $payload);

    $response->assertStatus(422)
        ->assertJsonStructure(['message', 'errors' => ['data_nascimento']]);
});

test('resposta de criação não inclui dados pessoais completos', function () {
    $response = $this->postJson('/api/v1/solicitacoes', payloadValido());

    $response->assertStatus(201)
        ->assertJsonPath('data.cpf_solicitante', '***.456.789-**')
        ->assertJsonMissingPath('data.data_nascimento');
});
