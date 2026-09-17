<?php

test('lista solicitações vazia retorna estrutura correta', function () {
    $response = $this->getJson('/api/v1/solicitacoes');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data',
            'meta' => ['total', 'per_page', 'current_page', 'last_page'],
            'links' => ['first', 'last', 'next', 'prev'],
        ])
        ->assertJsonPath('data', [])
        ->assertJsonPath('meta.total', 0);
});

test('filtra por status', function () {
    $this->postJson('/api/v1/solicitacoes', [
        'nome_solicitante' => 'Ana Beatriz',
        'cpf_solicitante'  => '111.222.333-44',
        'data_nascimento'  => '1992-07-10',
        'categoria'        => 'CONSULTA',
        'prioridade'       => 'BAIXA',
        'descricao'        => 'Consulta de rotina anual para checkup geral completo.',
    ])->assertStatus(201);

    $all      = $this->getJson('/api/v1/solicitacoes')->assertStatus(200);
    $filtered = $this->getJson('/api/v1/solicitacoes?status=RECEBIDA')->assertStatus(200);
    $empty    = $this->getJson('/api/v1/solicitacoes?status=CONCLUIDA')->assertStatus(200);

    expect($all->json('meta.total'))->toBe(1);
    expect($filtered->json('meta.total'))->toBe(1);
    expect($empty->json('meta.total'))->toBe(0);
});

test('status inválido no filtro retorna 422', function () {
    $response = $this->getJson('/api/v1/solicitacoes?status=INVALIDO');

    $response->assertStatus(422);
});

test('per_page inválido retorna 422', function () {
    $response = $this->getJson('/api/v1/solicitacoes?per_page=200');

    $response->assertStatus(422);
});
