<?php

namespace App\Domain\Solicitacoes\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TentativaContatoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'resultado' => $this->resultado,
            'realizada_em' => $this->realizada_em?->utc()->toIso8601String(),
        ];
    }
}
