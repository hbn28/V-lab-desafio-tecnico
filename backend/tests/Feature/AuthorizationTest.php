<?php

use App\Models\Solicitacao;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

test('requisições operacionais exigem autenticação', function () {
    Auth::guard('web')->logout();
    Auth::forgetGuards();
    $this->getJson('/api/v1/solicitacoes')->assertUnauthorized();
});

test('atendente não pode apagar solicitação', function () {
    $solicitacao = Solicitacao::factory()->create();
    $this->actingAs(User::factory()->create(['role' => 'ATENDENTE']))
        ->deleteJson("/api/v1/solicitacoes/{$solicitacao->id}")
        ->assertForbidden();
    expect($solicitacao->fresh())->not->toBeNull();
});

test('administrador pode apagar solicitação', function () {
    $solicitacao = Solicitacao::factory()->create();
    $this->actingAs(User::factory()->create(['role' => 'ADMINISTRADOR']))
        ->deleteJson("/api/v1/solicitacoes/{$solicitacao->id}")
        ->assertNoContent();
    expect($solicitacao->fresh())->toBeNull();
});

test('usuário desativado não pode usar sessão antiga', function () {
    $this->actingAs(User::factory()->create(['is_active' => false]))
        ->getJson('/api/v1/solicitacoes')
        ->assertForbidden();
});
