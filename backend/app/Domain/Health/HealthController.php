<?php

namespace App\Domain\Health;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthController
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::select('SELECT 1');
            $db = 'ok';
            $code = 200;
        } catch (\Throwable) {
            $db = 'error';
            $code = 503;
        }

        return response()->json([
            'status' => $code === 200 ? 'ok' : 'degraded',
            'db' => $db,
        ], $code);
    }
}
