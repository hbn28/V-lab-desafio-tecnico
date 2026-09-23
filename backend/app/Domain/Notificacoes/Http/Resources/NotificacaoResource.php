<?php

namespace App\Domain\Notificacoes\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificacaoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'solicitacao_id' => $this->solicitacao_id,
            'protocolo' => $this->protocolo,
            'status_anterior' => $this->status_anterior,
            'status_novo' => $this->status_novo,
            'created_at' => $this->created_at?->toIso8601String(),
            'read_at' => $this->read_at?->toIso8601String(),
        ];
    }
}
