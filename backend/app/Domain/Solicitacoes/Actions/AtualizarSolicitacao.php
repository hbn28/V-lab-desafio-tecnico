<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Domain\Solicitacoes\Exceptions\ConflitoDeEstado;
use App\Models\Solicitacao;
use Illuminate\Support\Facades\DB;

class AtualizarSolicitacao
{
    public function __construct(private readonly LocalizarOuCriarPaciente $localizarOuCriarPaciente) {}

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
                throw new ConflitoDeEstado(
                    "Não é possível editar uma solicitação com status '{$solicitacao->status}'."
                );
            }

            // Trocar o CPF troca de paciente: o vínculo segue o CPF, com a mesma
            // regra de consistência de nascimento usada na criação.
            $paciente = $this->localizarOuCriarPaciente->execute($data, $solicitacao);

            $solicitacao->update([
                'paciente_id' => $paciente->id,
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
}
