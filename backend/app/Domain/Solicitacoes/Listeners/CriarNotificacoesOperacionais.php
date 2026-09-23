<?php

namespace App\Domain\Solicitacoes\Listeners;

use App\Domain\Solicitacoes\Events\SolicitacaoStatusAtualizado;
use App\Models\NotificacaoOperacional;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

class CriarNotificacoesOperacionais implements ShouldQueue
{
    public int $tries = 3;

    public int $backoff = 5;

    public function handle(SolicitacaoStatusAtualizado $event): void
    {
        try {
            User::query()->where('is_active', true)->pluck('id')->each(function (int $userId) use ($event) {
                NotificacaoOperacional::query()->insertOrIgnore([
                    'event_id' => $event->eventId,
                    'request_id' => $event->requestId,
                    'user_id' => $userId,
                    'solicitacao_id' => $event->solicitacaoId,
                    'protocolo' => $event->protocolo,
                    'status_anterior' => $event->statusAnterior,
                    'status_novo' => $event->statusNovo,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
            Log::info('notificacoes_criadas', ['event_id' => $event->eventId, 'request_id' => $event->requestId]);
        } catch (\Throwable $e) {
            Log::error('notificacoes_falharam', ['event_id' => $event->eventId, 'request_id' => $event->requestId]);
            throw $e;
        }
    }
}
