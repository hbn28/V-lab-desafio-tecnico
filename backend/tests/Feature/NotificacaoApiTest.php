<?php

use App\Models\NotificacaoOperacional;
use App\Models\Solicitacao;
use App\Models\User;
use Illuminate\Support\Str;

function criarNotificacao(User $user, Solicitacao $solicitacao): NotificacaoOperacional
{
    return NotificacaoOperacional::create([
        'event_id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'solicitacao_id' => $solicitacao->id,
        'protocolo' => $solicitacao->protocolo,
        'status_anterior' => 'RECEBIDA',
        'status_novo' => 'EM_ANALISE',
    ]);
}

test('lista apenas notificações do operador e marca somente a própria', function () {
    $first = User::factory()->create();
    $second = User::factory()->create();
    $solicitacao = Solicitacao::factory()->create();
    $own = criarNotificacao($first, $solicitacao);
    $other = criarNotificacao($second, $solicitacao);

    $this->actingAs($first)->getJson('/api/v1/notificacoes')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('unread_count', 1)
        ->assertJsonPath('data.0.id', $own->id);

    $this->patchJson("/api/v1/notificacoes/{$other->id}/lida")->assertNotFound();
    expect($other->fresh()->read_at)->toBeNull();

    $this->patchJson("/api/v1/notificacoes/{$own->id}/lida")
        ->assertOk()
        ->assertJsonPath('data.id', $own->id);
    expect($own->fresh()->read_at)->not->toBeNull();
});

test('página notificações antigas mantém acessível a fila além dos vinte itens recentes', function () {
    $user = User::factory()->create();
    $oldest = null;
    for ($index = 0; $index < 21; $index++) {
        $solicitacao = Solicitacao::factory()->create();
        $notification = criarNotificacao($user, $solicitacao);
        $oldest ??= $notification;
    }

    $this->actingAs($user)->getJson('/api/v1/notificacoes?page=2')
        ->assertOk()
        ->assertJsonPath('unread_count', 21)
        ->assertJsonPath('meta.total', 21)
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonPath('meta.last_page', 2)
        ->assertJsonPath('data.0.id', $oldest->id);
});
