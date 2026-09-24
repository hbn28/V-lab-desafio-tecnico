<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('comando interativo cria administrador ativo em produção com senha protegida', function () {
    config()->set('app.env', 'production');

    $this->artisan('operadores:criar')
        ->expectsQuestion('Usuário', 'novo-operador')
        ->expectsQuestion('E-mail (opcional)', '')
        ->expectsQuestion('Senha', 'SenhaForte!123')
        ->expectsQuestion('Confirme a senha', 'SenhaForte!123')
        ->expectsOutput('Operador criado com sucesso.')
        ->assertExitCode(0);

    $user = User::where('username', 'novo-operador')->firstOrFail();

    expect($user->name)->toBe('novo-operador')
        ->and($user->email)->toBeNull()
        ->and($user->role)->toBe('ADMINISTRADOR')
        ->and($user->is_active)->toBeTrue()
        ->and($user->password)->not->toBe('SenhaForte!123')
        ->and(Hash::check('SenhaForte!123', $user->password))->toBeTrue();
});

test('comando recusa usuário já cadastrado sem alterar a conta', function () {
    $existing = User::factory()->create([
        'username' => 'existente',
        'password' => 'senha-original',
    ]);

    $this->artisan('operadores:criar')
        ->expectsQuestion('Usuário', 'existente')
        ->expectsQuestion('E-mail (opcional)', '')
        ->expectsQuestion('Senha', 'SenhaForte!123')
        ->expectsQuestion('Confirme a senha', 'SenhaForte!123')
        ->assertExitCode(1);

    expect(User::where('username', 'existente')->count())->toBe(1)
        ->and(User::findOrFail($existing->id)->password)->toBe($existing->password);
});

test('comando recusa senha fraca e confirmação divergente', function ($password, $confirmation) {
    $this->artisan('operadores:criar')
        ->expectsQuestion('Usuário', 'novo-operador')
        ->expectsQuestion('E-mail (opcional)', '')
        ->expectsQuestion('Senha', $password)
        ->expectsQuestion('Confirme a senha', $confirmation)
        ->assertExitCode(1);

    expect(User::where('username', 'novo-operador')->exists())->toBeFalse();
})->with([
    ['', ''],
    ['SenhaForte!123', 'outra-senha'],
]);
