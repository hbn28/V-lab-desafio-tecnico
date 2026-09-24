<?php

use App\Models\Solicitacao;

test('id não numérico na rota responde 404 no formato padrão', function () {
    $this->getJson('/api/v1/solicitacoes/abc')
        ->assertNotFound()->assertExactJson(['message' => 'Recurso não encontrado.', 'errors' => []]);
});

test('listagem mascara o CPF; o detalhe traz o CPF completo', function () {
    $solicitacao = Solicitacao::factory()->create(['cpf_solicitante' => '123.456.789-00']);

    $this->getJson('/api/v1/solicitacoes')->assertOk()
        ->assertJsonPath('data.0.cpf_solicitante', '***.456.789-**');

    $this->getJson("/api/v1/solicitacoes/{$solicitacao->id}")->assertOk()
        ->assertJsonPath('data.cpf_solicitante', '123.456.789-00');
});

test('conflito de estado responde 409 no formato padrão', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'CONCLUIDA']);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", ['status' => 'CANCELADA'])
        ->assertStatus(409)
        ->assertExactJson(['message' => "Transição de 'CONCLUIDA' para 'CANCELADA' não é permitida.", 'errors' => []]);
});
