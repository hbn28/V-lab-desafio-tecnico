<?php

use App\Models\Paciente;
use App\Models\Solicitacao;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('solicitacao pertence a paciente e preserva snapshot historico', function () {
    $paciente = Paciente::factory()->create([
        'nome' => 'Maria da Silva',
        'cpf' => '12345678900',
        'data_nascimento' => '1985-06-15',
        'celular' => '81999990000',
    ]);

    $solicitacao = Solicitacao::factory()->create([
        'paciente_id' => $paciente->id,
        'nome_solicitante' => 'Maria da Silva',
        'cpf_solicitante' => '123.456.789-00',
        'data_nascimento' => '1985-06-15',
    ]);

    expect($solicitacao->paciente->is($paciente))->toBeTrue()
        ->and($paciente->solicitacoes()->count())->toBe(1)
        ->and($solicitacao->cpf_solicitante)->toBe('123.456.789-00');
});

test('criar solicitacao reutiliza paciente pelo cpf normalizado', function () {
    $paciente = Paciente::factory()->create([
        'nome' => 'Maria da Silva',
        'cpf' => '12345678900',
        'data_nascimento' => '1985-06-15',
        'celular' => '81999990000',
    ]);

    $response = $this->postJson('/api/v1/solicitacoes', [
        'nome_solicitante' => 'Maria da Silva',
        'cpf_solicitante' => '123.456.789-00',
        'data_nascimento' => '1985-06-15',
        'celular' => '(81) 99999-0000',
        'categoria' => 'CONSULTA',
        'prioridade' => 'MEDIA',
        'descricao' => 'Consulta ficticia.',
        'justificativa_prioridade' => null,
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.paciente.id', $paciente->id)
        ->assertJsonPath('data.paciente.celular_mascarado', '(81) *****-0000');

    expect(Paciente::count())->toBe(1);
});

test('cpf existente com nascimento divergente retorna 422', function () {
    Paciente::factory()->create([
        'nome' => 'Maria da Silva',
        'cpf' => '12345678900',
        'data_nascimento' => '1985-06-15',
    ]);

    $this->postJson('/api/v1/solicitacoes', [
        'nome_solicitante' => 'Maria da Silva',
        'cpf_solicitante' => '123.456.789-00',
        'data_nascimento' => '1990-01-20',
        'categoria' => 'CONSULTA',
        'prioridade' => 'MEDIA',
        'descricao' => 'Consulta ficticia.',
        'justificativa_prioridade' => null,
    ])->assertStatus(422)->assertJsonStructure(['message', 'errors' => ['cpf_solicitante']]);
});
