<?php

namespace App\Domain\Solicitacoes\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AgendamentoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'data_agendada' => $this->data_agendada?->toDateString(),
            'modalidade' => $this->modalidade,
            'hora_agendada' => $this->hora_agendada !== null ? substr($this->hora_agendada, 0, 5) : null,
            'turno' => $this->turno,
            'status' => $this->status,
            'resultado_em' => $this->resultado_em?->utc()->toIso8601String(),
            'falta_registrada_em' => $this->falta_registrada_em?->utc()->toIso8601String(),
            'falta_corrigida_em' => $this->falta_corrigida_em?->utc()->toIso8601String(),
            'solicitacao' => new SolicitacaoResource($this->whenLoaded('solicitacao')),
            'ultima_tentativa_contato' => new TentativaContatoResource($this->whenLoaded('ultimaTentativaContato')),
        ];
    }
}
