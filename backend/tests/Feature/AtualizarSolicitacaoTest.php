<?php

use App\Models\Paciente;
use App\Models\Solicitacao;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    DB::statement('
        CREATE TABLE IF NOT EXISTS protocolo_counters (
            ano INT PRIMARY KEY,
            ultimo_numero INT NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0)
        )
    ');
});

function payloadEdicaoValido(): array
{
    return [
        'nome_solicitante' => 'Maria Silva Atualizada',
        'cpf_solicitante' => '123.456.789-00',
        'data_nascimento' => '1985-06-15',
        'categoria' => 'EXAME',
        'prioridade' => 'ALTA',
        'descricao' => 'Descrição corrigida após erro de cadastro inicial.',
    ];
}

test('edita solicitação em estado RECEBIDA', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'RECEBIDA']);

    $response = $this->putJson("/api/v1/solicitacoes/{$solicitacao->id}", payloadEdicaoValido());

    $response->assertStatus(200)
        ->assertJsonPath('data.nome_solicitante', 'Maria Silva Atualizada')
        ->assertJsonPath('data.categoria', 'EXAME')
        ->assertJsonPath('data.status', 'RECEBIDA');
});

test('edição religa a solicitação ao paciente correspondente ao novo CPF', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'RECEBIDA']);
    $pacienteDestino = Paciente::factory()->create([
        'cpf' => '98765432100',
        'data_nascimento' => '1990-01-20',
        'celular' => '81987654321',
    ]);

    $payload = payloadEdicaoValido();
    $payload['cpf_solicitante'] = '987.654.321-00';
    $payload['data_nascimento'] = '1990-01-20';

    $this->putJson("/api/v1/solicitacoes/{$solicitacao->id}", $payload)
        ->assertOk()
        ->assertJsonPath('data.paciente.id', $pacienteDestino->id)
        ->assertJsonPath('data.paciente.celular_mascarado', '(81) *****-4321');

    expect($solicitacao->fresh()->paciente_id)->toBe($pacienteDestino->id);
});

test('edição rejeita CPF existente com nascimento divergente sem mudar a relação', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'RECEBIDA']);
    $pacienteOriginal = $solicitacao->paciente;
    Paciente::factory()->create([
        'cpf' => '98765432100',
        'data_nascimento' => '1990-01-20',
    ]);

    $payload = payloadEdicaoValido();
    $payload['cpf_solicitante'] = '987.654.321-00';
    $payload['data_nascimento'] = '1991-01-20';

    $this->putJson("/api/v1/solicitacoes/{$solicitacao->id}", $payload)
        ->assertStatus(422)
        ->assertJsonStructure(['message', 'errors' => ['cpf_solicitante']]);

    expect($solicitacao->fresh()->paciente_id)->toBe($pacienteOriginal->id);
});

test('rejeita edição de solicitação CONCLUIDA', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'CONCLUIDA']);

    $response = $this->putJson("/api/v1/solicitacoes/{$solicitacao->id}", payloadEdicaoValido());

    $response->assertStatus(409);
});

test('rejeita edição de solicitação CANCELADA', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'CANCELADA']);

    $response = $this->putJson("/api/v1/solicitacoes/{$solicitacao->id}", payloadEdicaoValido());

    $response->assertStatus(409);
});

test('rejeita edição com dados inválidos', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'RECEBIDA']);
    $payload = payloadEdicaoValido();
    $payload['descricao'] = '';

    $response = $this->putJson("/api/v1/solicitacoes/{$solicitacao->id}", $payload);

    $response->assertStatus(422);
});

test('rejeita alterar status via edição', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'RECEBIDA']);
    $payload = payloadEdicaoValido();
    $payload['status'] = 'CONCLUIDA';

    $response = $this->putJson("/api/v1/solicitacoes/{$solicitacao->id}", $payload);

    $response->assertStatus(422);
});

test('retorna 404 ao editar solicitação inexistente', function () {
    $response = $this->putJson('/api/v1/solicitacoes/999999', payloadEdicaoValido());

    $response->assertStatus(404);
});

test('apaga solicitação existente', function () {
    $solicitacao = Solicitacao::factory()->create();

    $response = $this->deleteJson("/api/v1/solicitacoes/{$solicitacao->id}");

    $response->assertStatus(204);
    $this->assertDatabaseMissing('solicitacoes', ['id' => $solicitacao->id]);
});

test('retorna 404 ao apagar solicitação inexistente', function () {
    $response = $this->deleteJson('/api/v1/solicitacoes/999999');

    $response->assertStatus(404);
});
