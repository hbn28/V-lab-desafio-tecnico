<?php

use App\Models\User;
use Database\Seeders\UsuariosDemoSeeder;
use Illuminate\Support\Facades\Hash;

test('credenciais locais fictícias são idempotentes e não sobrescrevem senha', function () {
    putenv('DEMO_ADMIN_EMAIL=admin@example.test');
    putenv('DEMO_ADMIN_PASSWORD=local-test-pass');
    $_ENV['DEMO_ADMIN_EMAIL'] = 'admin@example.test';
    $_ENV['DEMO_ADMIN_PASSWORD'] = 'local-test-pass';

    try {
        $this->seed(UsuariosDemoSeeder::class);
        $hash = User::where('email', 'admin@example.test')->firstOrFail()->password;
        $this->seed(UsuariosDemoSeeder::class);

        expect(User::where('email', 'admin@example.test')->count())->toBe(1)
            ->and(User::where('email', 'admin@example.test')->firstOrFail()->role)->toBe('ADMINISTRADOR')
            ->and(Hash::check('local-test-pass', $hash))->toBeTrue()
            ->and(User::where('email', 'admin@example.test')->firstOrFail()->password)->toBe($hash);
    } finally {
        putenv('DEMO_ADMIN_EMAIL');
        putenv('DEMO_ADMIN_PASSWORD');
        unset($_ENV['DEMO_ADMIN_EMAIL'], $_ENV['DEMO_ADMIN_PASSWORD']);
    }
});

test('produção não cria usuários de demonstração', function () {
    config()->set('app.env', 'production');
    $before = User::count();
    $this->seed(UsuariosDemoSeeder::class);
    expect(User::count())->toBe($before);
});
