<?php

namespace App\Domain\Solicitacoes\Http\Resources;

use App\Domain\Solicitacoes\Support\MascararContato;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PacienteResumoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nome' => $this->nome,
            'celular_mascarado' => MascararContato::celular($this->celular),
        ];
    }
}
