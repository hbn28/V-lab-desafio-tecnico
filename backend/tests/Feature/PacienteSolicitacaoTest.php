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

function payloadEdicao(array $extra = []): array
{
    return array_merge([
        'nome_solicitante' => 'Maria da Silva',
        'cpf_solicitante' => '123.456.789-00',
        'data_nascimento' => '1985-06-15',
        'categoria' => 'CONSULTA',
        'prioridade' => 'MEDIA',
        'descricao' => 'Consulta de rotina.',
    ], $extra);
}

test('editar o CPF revincula a solicitação ao paciente desse CPF', function () {
    $criada = $this->postJson('/api/v1/solicitacoes', payloadEdicao())->assertCreated()->json('data');
    $pacienteOriginal = Paciente::where('cpf', '12345678900')->firstOrFail();

    $this->putJson("/api/v1/solicitacoes/{$criada['id']}", payloadEdicao([
        'cpf_solicitante' => '987.654.321-00',
        'data_nascimento' => '1990-01-02',
    ]))->assertOk()->assertJsonPath('data.cpf_solicitante', '987.654.321-00');

    $novo = Paciente::where('cpf', '98765432100')->firstOrFail();
    expect(Solicitacao::find($criada['id'])->paciente_id)->toBe($novo->id)
        ->and($novo->data_nascimento->toDateString())->toBe('1990-01-02')
        ->and($pacienteOriginal->fresh())->not->toBeNull();
});

test('editar para um CPF de outro paciente exige a mesma data de nascimento', function () {
    Paciente::factory()->create(['cpf' => '98765432100', 'data_nascimento' => '1970-07-07']);
    $criada = $this->postJson('/api/v1/solicitacoes', payloadEdicao())->assertCreated()->json('data');

    $this->putJson("/api/v1/solicitacoes/{$criada['id']}", payloadEdicao([
        'cpf_solicitante' => '987.654.321-00',
        'data_nascimento' => '1990-01-02',
    ]))->assertStatus(422)->assertJsonStructure(['errors' => ['cpf_solicitante']]);

    expect(Solicitacao::find($criada['id'])->cpf_solicitante)->toBe('123.456.789-00');
});

test('corrigir a data de nascimento atualiza o cadastro quando o paciente só tem esta solicitação', function () {
    $criada = $this->postJson('/api/v1/solicitacoes', payloadEdicao())->assertCreated()->json('data');

    $this->putJson("/api/v1/solicitacoes/{$criada['id']}", payloadEdicao(['data_nascimento' => '1985-06-16']))
        ->assertOk();

    expect(Paciente::where('cpf', '12345678900')->first()->data_nascimento->toDateString())->toBe('1985-06-16');
});

test('corrigir a data de nascimento é bloqueada quando o paciente tem outras solicitações', function () {
    $primeira = $this->postJson('/api/v1/solicitacoes', payloadEdicao())->assertCreated()->json('data');
    $this->postJson('/api/v1/solicitacoes', payloadEdicao())->assertCreated();

    $this->putJson("/api/v1/solicitacoes/{$primeira['id']}", payloadEdicao(['data_nascimento' => '1985-06-16']))
        ->assertStatus(422)->assertJsonStructure(['errors' => ['cpf_solicitante']]);
});
