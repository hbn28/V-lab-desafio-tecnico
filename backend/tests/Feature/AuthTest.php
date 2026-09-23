<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;

beforeEach(function () {
    Auth::guard('web')->logout();
    Auth::forgetGuards();
});

test('login exige credenciais válidas sem revelar a conta', function () {
    $user = User::factory()->create(['password' => 'correct-password']);

    foreach ([['nobody@example.test', 'wrong'], [$user->email, 'wrong']] as [$email, $password]) {
        $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => $password])
            ->assertStatus(422)
            ->assertExactJson(['message' => 'Credenciais inválidas.', 'errors' => []]);
    }
});

test('me exige sessão autenticada', function () {
    $this->getJson('/api/v1/auth/me')->assertUnauthorized();
});

test('login inicia sessão e logout a invalida', function () {
    $user = User::factory()->create(['role' => 'ADMINISTRADOR', 'password' => 'local-test-pass']);

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'local-test-pass'])
        ->assertOk()
        ->assertJsonPath('data.role', 'ADMINISTRADOR')
        ->assertJsonMissingPath('data.password');
    $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.id', $user->id);
    $this->postJson('/api/v1/auth/logout')->assertOk();
    Auth::forgetGuards();
    $this->getJson('/api/v1/auth/me')->assertUnauthorized();
});

test('usuário inativo não pode entrar', function () {
    $user = User::factory()->create(['is_active' => false, 'password' => 'local-test-pass']);

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'local-test-pass'])
        ->assertStatus(422)
        ->assertExactJson(['message' => 'Credenciais inválidas.', 'errors' => []]);
});
