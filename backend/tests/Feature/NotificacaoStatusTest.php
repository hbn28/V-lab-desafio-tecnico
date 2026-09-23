<?php

use App\Domain\Solicitacoes\Events\SolicitacaoStatusAtualizado;
use App\Domain\Solicitacoes\Listeners\CriarNotificacoesOperacionais;
use App\Models\NotificacaoOperacional;
use App\Models\Solicitacao;
use App\Models\User;
use Illuminate\Support\Str;

test('listener é idempotente e ignora usuários inativos', function () {
    $active = User::factory()->create();
    $inactive = User::factory()->create(['is_active' => false]);
    $solicitacao = Solicitacao::factory()->create();
    $event = new SolicitacaoStatusAtualizado(
        eventId: (string) Str::uuid(),
        requestId: null,
        solicitacaoId: $solicitacao->id,
        protocolo: $solicitacao->protocolo,
        statusAnterior: 'RECEBIDA',
        statusNovo: 'EM_ANALISE',
    );

    app(CriarNotificacoesOperacionais::class)->handle($event);
    app(CriarNotificacoesOperacionais::class)->handle($event);

    expect(NotificacaoOperacional::where('user_id', $active->id)->count())->toBe(1)
        ->and(NotificacaoOperacional::where('user_id', $inactive->id)->count())->toBe(0);
});
