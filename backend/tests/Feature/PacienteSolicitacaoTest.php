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
