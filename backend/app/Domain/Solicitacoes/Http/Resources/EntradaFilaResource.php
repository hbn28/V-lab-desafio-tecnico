<?php

namespace App\Domain\Solicitacoes\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EntradaFilaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'entrou_em' => $this->entrou_em?->utc()->toIso8601String(),
            'solicitacao' => new SolicitacaoResource($this->whenLoaded('solicitacao')),
        ];
    }
}
