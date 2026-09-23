<?php

use App\Models\User;
use Database\Seeders\UsuariosDemoSeeder;
use Illuminate\Support\Facades\Hash;

test('credenciais locais fictícias são idempotentes e não sobrescrevem senha', function () {
    $keys = ['DEMO_ADMIN_EMAIL', 'DEMO_ADMIN_PASSWORD'];
    $original = [];
    foreach ($keys as $key) {
        $original[$key] = [
            'env_exists' => array_key_exists($key, $_ENV),
            'env' => $_ENV[$key] ?? null,
            'server_exists' => array_key_exists($key, $_SERVER),
            'server' => $_SERVER[$key] ?? null,
            'process' => getenv($key),
        ];
        // CI copies .env.example, so these values already exist as empty strings in $_SERVER.
        $_SERVER[$key] = '';
    }

    putenv('DEMO_ADMIN_EMAIL=admin@example.test');
    putenv('DEMO_ADMIN_PASSWORD=local-test-pass');
    $_ENV['DEMO_ADMIN_EMAIL'] = 'admin@example.test';
    $_ENV['DEMO_ADMIN_PASSWORD'] = 'local-test-pass';
    $_SERVER['DEMO_ADMIN_EMAIL'] = 'admin@example.test';
    $_SERVER['DEMO_ADMIN_PASSWORD'] = 'local-test-pass';

    try {
        $this->seed(UsuariosDemoSeeder::class);
        $hash = User::where('email', 'admin@example.test')->firstOrFail()->password;
        $this->seed(UsuariosDemoSeeder::class);

        expect(User::where('email', 'admin@example.test')->count())->toBe(1)
            ->and(User::where('email', 'admin@example.test')->firstOrFail()->role)->toBe('ADMINISTRADOR')
            ->and(Hash::check('local-test-pass', $hash))->toBeTrue()
            ->and(User::where('email', 'admin@example.test')->firstOrFail()->password)->toBe($hash);
    } finally {
        foreach ($keys as $key) {
            if ($original[$key]['process'] === false) {
                putenv($key);
            } else {
                putenv($key.'='.$original[$key]['process']);
            }
            if ($original[$key]['env_exists']) {
                $_ENV[$key] = $original[$key]['env'];
            } else {
                unset($_ENV[$key]);
            }
            if ($original[$key]['server_exists']) {
                $_SERVER[$key] = $original[$key]['server'];
            } else {
                unset($_SERVER[$key]);
            }
        }
    }
});

test('produção não cria usuários de demonstração', function () {
    config()->set('app.env', 'production');
    $before = User::count();
    $this->seed(UsuariosDemoSeeder::class);
    expect(User::count())->toBe($before);
});
