<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    /**
     * docker-compose.yml define DB_CONNECTION/APP_ENV como variáveis de ambiente
     * reais do container backend. Illuminate\Support\Env resolve env() a partir de
     * $_SERVER antes de getenv(), então nem o <env force="true"> do phpunit.xml
     * consegue sobrescrever isso — RefreshDatabase acabava rodando contra o banco
     * de desenvolvimento (vlab) em vez do banco de teste (vlab_test). Força aqui,
     * antes de parent::setUp() disparar o boot da aplicação e o refresh do banco.
     */
    protected function setUp(): void
    {
        foreach (['APP_ENV' => 'testing', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array'] as $name => $value) {
            putenv("{$name}={$value}");
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
        putenv('DB_CONNECTION=pgsql_test');
        $_ENV['DB_CONNECTION'] = 'pgsql_test';
        $_SERVER['DB_CONNECTION'] = 'pgsql_test';

        parent::setUp();

        $this->actingAs(User::factory()->create(['role' => 'ADMINISTRADOR']));
    }
}
