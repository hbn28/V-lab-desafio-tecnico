<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Propaga (ou gera) um X-Request-ID por requisição e registra uma linha de log
 * estruturada `api_request` com método, caminho, status e duração.
 *
 * O log é escrito no próprio handle(), depois da resposta pronta: um
 * terminate() rodaria numa instância nova do middleware (o Laravel resolve de
 * novo a classe ao terminar), sem acesso ao instante de início.
 */
class RequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $inicio = microtime(true);

        $incomingId = (string) $request->header('X-Request-ID', '');
        $requestId = $this->isValidUuid($incomingId) ? $incomingId : (string) Str::uuid();

        $request->attributes->set('request_id', $requestId);
        Log::withContext(['request_id' => $requestId]);

        $response = $next($request);
        $response->headers->set('X-Request-ID', $requestId);

        Log::info('api_request', [
            'method' => $request->method(),
            'path' => $request->path(),
            'status' => $response->getStatusCode(),
            'duration_ms' => (int) round((microtime(true) - $inicio) * 1000),
        ]);

        return $response;
    }

    private function isValidUuid(string $value): bool
    {
        return (bool) preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
            $value
        );
    }
}
