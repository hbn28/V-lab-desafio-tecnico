<?php

use App\Http\Middleware\RequestId;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

test('preserva request id válido na resposta', function () {
    $id = 'd1f26f58-50a7-4144-9c18-df44818f3652';

    $this->withHeader('X-Request-ID', $id)
        ->getJson('/api/v1/health')
        ->assertOk()
        ->assertHeader('X-Request-ID', $id);
});

test('substitui request id inválido e não registra dados do paciente', function () {
    Log::spy();
    $request = Request::create('/api/v1/solicitacoes', 'POST', ['nome_solicitante' => 'SEGREDO_TESTE']);
    $request->headers->set('X-Request-ID', 'invalid');
    $middleware = new RequestId;
    $response = $middleware->handle($request, fn () => new Response('', 422));
    (new RequestId)->terminate($request, $response);

    $id = $response->headers->get('X-Request-ID');
    expect($id)->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i');

    Log::shouldHaveReceived('info')->with('api_request', Mockery::on(function (array $context) use ($response) {
        return $context['method'] === 'POST'
            && $context['path'] === 'api/v1/solicitacoes'
            && $context['status'] === $response->getStatusCode()
            && $context['duration_ms'] >= 0
            && ! str_contains(json_encode($context), 'SEGREDO_TESTE');
    }));
});
