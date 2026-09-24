<?php

namespace App\Domain\Solicitacoes\Http\Resources;

use App\Domain\Solicitacoes\Support\MascararContato;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SolicitacaoResource extends JsonResource
{
    private bool $comDadosPessoaisCompletos = false;

    public static function detalhe(mixed $resource): static
    {
        $instancia = new static($resource);
        $instancia->comDadosPessoaisCompletos = true;

        return $instancia;
    }

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'protocolo' => $this->protocolo,
            'nome_solicitante' => $this->nome_solicitante,
            'cpf_solicitante' => $this->comDadosPessoaisCompletos
                ? $this->cpf_solicitante
                : MascararContato::cpf($this->cpf_solicitante),
            ...($this->comDadosPessoaisCompletos ? ['data_nascimento' => $this->data_nascimento?->toDateString()] : []),
            'categoria' => $this->categoria,
            'prioridade' => $this->prioridade,
            'status' => $this->status,
            'agendado_para' => $this->agendado_para?->utc()->toIso8601String(),
            'descricao' => $this->descricao,
            'justificativa_prioridade' => $this->justificativa_prioridade,
            'data_criacao' => $this->created_at?->toIso8601String(),
            'data_atualizacao' => $this->updated_at?->toIso8601String(),
            'paciente' => new PacienteResumoResource($this->whenLoaded('paciente')),
            'agendamento_ativo' => new AgendamentoResource($this->whenLoaded('agendamentoAtivo')),
        ];
    }
}
