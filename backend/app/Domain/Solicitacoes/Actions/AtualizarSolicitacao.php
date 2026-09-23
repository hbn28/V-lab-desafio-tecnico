<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Paciente;
use App\Models\Solicitacao;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

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

            $paciente = $this->localizarOuCriarPaciente($data);

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

            return $solicitacao->fresh()->load('paciente');
        });
    }

    /** Mantém o vínculo por CPF normalizado sem alterar o cadastro histórico do paciente. */
    private function localizarOuCriarPaciente(array $data): Paciente
    {
        $cpf = preg_replace('/\\D+/', '', $data['cpf_solicitante']);
        $paciente = Paciente::query()->where('cpf', $cpf)->lockForUpdate()->first();

        if ($paciente !== null && $paciente->data_nascimento->toDateString() !== $data['data_nascimento']) {
            throw ValidationException::withMessages([
                'cpf_solicitante' => ['CPF já cadastrado com outra data de nascimento.'],
            ]);
        }

        return $paciente ?? Paciente::query()->create([
            'nome' => $data['nome_solicitante'],
            'cpf' => $cpf,
            'data_nascimento' => $data['data_nascimento'],
        ]);
    }

    private function conflito(string $mensagem): never
    {
        throw new HttpResponseException(
            response()->json(['message' => $mensagem, 'errors' => []], 409)
        );
    }
}
