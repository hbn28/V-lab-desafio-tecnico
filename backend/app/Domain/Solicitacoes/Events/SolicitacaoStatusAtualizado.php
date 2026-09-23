<?php

namespace App\Domain\Solicitacoes\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

class SolicitacaoStatusAtualizado implements ShouldDispatchAfterCommit
{
    public function __construct(
        public readonly string $eventId,
        public readonly ?string $requestId,
        public readonly int $solicitacaoId,
        public readonly string $protocolo,
        public readonly string $statusAnterior,
        public readonly string $statusNovo,
    ) {}
}
