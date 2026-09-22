<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Solicitacao;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class AtualizarSolicitacao
{
    /**
     * Estados finais não podem mais ser editados: a trilha de auditoria
     * de uma solicitação concluída ou cancelada é considerada encerrada.
     *
     * @var string[]
     */
    private const ESTADOS_ENCERRADOS = ['CONCLUIDA', 'CANCELADA'];

    public function execute(Solicitacao $solicitacao, array $data): Solicitacao
    {
        return DB::transaction(function () use ($solicitacao, $data) {
            $solicitacao = Solicitacao::lockForUpdate()->findOrFail($solicitacao->id);

            if (in_array($solicitacao->status, self::ESTADOS_ENCERRADOS, true)) {
                $this->conflito(
                    "Não é possível editar uma solicitação com status '{$solicitacao->status}'."
                );
            }

            $solicitacao->update([
                'nome_solicitante' => $data['nome_solicitante'],
                'cpf_solicitante' => $data['cpf_solicitante'],
                'data_nascimento' => $data['data_nascimento'],
                'categoria' => $data['categoria'],
                'prioridade' => $data['prioridade'],
                'descricao' => $data['descricao'],
                'justificativa_prioridade' => $data['justificativa_prioridade'] ?? null,
            ]);

            return $solicitacao->fresh();
        });
    }

    private function conflito(string $mensagem): never
    {
        throw new HttpResponseException(
            response()->json(['message' => $mensagem, 'errors' => []], 409)
        );
    }
}
