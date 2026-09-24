<?php

return [
    'default' => env('DB_CONNECTION', 'pgsql'),
    'connections' => [
        'pgsql' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'vlab'),
            'username' => env('DB_USERNAME', 'vlab'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'schema' => 'public',
            'sslmode' => 'prefer',
            // A aplicação grava timestamps em UTC sem offset; fixar o fuso da sessão
            // evita que um Postgres configurado em outro fuso desloque os instantes.
            'timezone' => 'UTC',
        ],
        'pgsql_test' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE_TEST', 'vlab_test'),
            'username' => env('DB_USERNAME', 'vlab'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'schema' => 'public',
            'sslmode' => 'prefer',
            // A aplicação grava timestamps em UTC sem offset; fixar o fuso da sessão
            // evita que um Postgres configurado em outro fuso desloque os instantes.
            'timezone' => 'UTC',
        ],
    ],
    'migrations' => 'migrations',
];
