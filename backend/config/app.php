<?php

return [
    'name'     => env('APP_NAME', 'Solicitações de Atendimento'),
    'env'      => env('APP_ENV', 'production'),
    'debug'    => (bool) env('APP_DEBUG', false),
    'url'      => env('APP_URL', 'http://localhost'),
    'timezone' => 'UTC',
    'locale'   => 'pt_BR',
    'fallback_locale' => 'en',
    'key'      => env('APP_KEY'),
    'cipher'   => 'AES-256-CBC',
    'providers' => \Illuminate\Support\ServiceProvider::defaultProviders()->toArray(),
];
