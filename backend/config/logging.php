<?php

use Monolog\Formatter\JsonFormatter;
use Monolog\Handler\StreamHandler;

return [
    'default' => env('LOG_CHANNEL', 'stack'),
    'channels' => [
        'stack' => [
            'driver' => 'stack',
            'channels' => ['daily'],
        ],
        'daily' => [
            'driver' => 'monolog',
            'handler' => StreamHandler::class,
            'with' => [
                'stream' => storage_path('logs/laravel.log'),
            ],
            'formatter' => JsonFormatter::class,
            'level' => env('LOG_LEVEL', 'debug'),
        ],
        // Canal usado no docker-compose (LOG_CHANNEL=stderr): uma linha JSON por
        // evento em `docker compose logs backend`, com o request_id no contexto.
        'stderr' => [
            'driver' => 'monolog',
            'handler' => StreamHandler::class,
            'with' => [
                'stream' => 'php://stderr',
            ],
            'formatter' => JsonFormatter::class,
            'level' => env('LOG_LEVEL', 'debug'),
        ],
    ],
];
