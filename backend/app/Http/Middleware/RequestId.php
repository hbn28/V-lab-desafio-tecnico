<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class RequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->attributes->set('request_started_at', microtime(true));

        $incomingId = $request->header('X-Request-ID', '');
        $requestId = $this->isValidUuid($incomingId)
            ? $incomingId
            : (string) Str::uuid();

        $request->attributes->set('request_id', $requestId);
        Log::withContext(['request_id' => $requestId]);

        $response = $next($request);
        $response->headers->set('X-Request-ID', $requestId);

        return $response;
    }

    public function terminate(Request $request, Response $response): void
    {
        $startTime = $request->attributes->get('request_started_at');
        if (! is_float($startTime)) {
            return;
        }

        $durationMs = (int) round((microtime(true) - $startTime) * 1000);

        Log::info('api_request', [
            'method' => $request->method(),
            'path' => $request->path(),
            'status' => $response->getStatusCode(),
            'duration_ms' => $durationMs,
        ]);
    }

    private function isValidUuid(string $value): bool
    {
        return (bool) preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
            $value
        );
    }
}
