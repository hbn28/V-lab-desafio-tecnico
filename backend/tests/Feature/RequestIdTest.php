<?php

use Illuminate\Support\Facades\Log;

test('toda resposta da API carrega um X-Request-ID e gera o log api_request', function () {
    Log::spy();

    $resposta = $this->getJson('/api/v1/solicitacoes')->assertOk();
    $requestId = $resposta->headers->get('X-Request-ID');

    expect($requestId)->toMatch('/^[0-9a-f-]{36}$/');

    Log::shouldHaveReceived('info')->withArgs(
        fn (string $mensagem, array $contexto) => $mensagem === 'api_request'
            && $contexto['method'] === 'GET'
            && $contexto['path'] === 'api/v1/solicitacoes'
            && $contexto['status'] === 200
            && is_int($contexto['duration_ms'])
    )->once();
});

test('X-Request-ID recebido e válido é reaproveitado', function () {
    $id = 'a3bb189e-8bf9-4888-9912-ace4e6543002';

    $this->getJson('/api/v1/solicitacoes', ['X-Request-ID' => $id])
        ->assertOk()->assertHeader('X-Request-ID', $id);
});

test('id não numérico na rota responde 404 no formato padrão', function () {
    $this->getJson('/api/v1/solicitacoes/abc')
        ->assertNotFound()->assertExactJson(['message' => 'Recurso não encontrado.', 'errors' => []]);
});
