<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('comando interativo cria administrador ativo em produção com senha protegida', function () {
    config()->set('app.env', 'production');

    $this->artisan('operadores:criar')
        ->expectsQuestion('Nome', 'Operador de teste')
        ->expectsQuestion('E-mail', 'novo-operador@example.test')
        ->expectsQuestion('Senha', 'SenhaForte!123')
        ->expectsQuestion('Confirme a senha', 'SenhaForte!123')
        ->expectsOutput('Operador criado com sucesso.')
        ->assertExitCode(0);

    $user = User::where('email', 'novo-operador@example.test')->firstOrFail();

    expect($user->name)->toBe('Operador de teste')
        ->and($user->role)->toBe('ADMINISTRADOR')
        ->and($user->is_active)->toBeTrue()
        ->and($user->password)->not->toBe('SenhaForte!123')
        ->and(Hash::check('SenhaForte!123', $user->password))->toBeTrue();
});

test('comando recusa e-mail já cadastrado sem alterar a conta', function () {
    $existing = User::factory()->create([
        'email' => 'existente@example.test',
        'password' => 'senha-original',
    ]);

    $this->artisan('operadores:criar')
        ->expectsQuestion('Nome', 'Outro operador')
        ->expectsQuestion('E-mail', 'existente@example.test')
        ->expectsQuestion('Senha', 'SenhaForte!123')
        ->expectsQuestion('Confirme a senha', 'SenhaForte!123')
        ->assertExitCode(1);

    expect(User::where('email', 'existente@example.test')->count())->toBe(1)
        ->and(User::findOrFail($existing->id)->password)->toBe($existing->password);
});

test('comando recusa senha fraca e confirmação divergente', function ($password, $confirmation) {
    $this->artisan('operadores:criar')
        ->expectsQuestion('Nome', 'Operador de teste')
        ->expectsQuestion('E-mail', 'novo-operador@example.test')
        ->expectsQuestion('Senha', $password)
        ->expectsQuestion('Confirme a senha', $confirmation)
        ->assertExitCode(1);

    expect(User::where('email', 'novo-operador@example.test')->exists())->toBeFalse();
})->with([
    ['curta', 'curta'],
    ['SenhaForte!123', 'outra-senha'],
]);
