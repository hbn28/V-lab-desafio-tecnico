<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Paciente;
use App\Models\Solicitacao;
use Illuminate\Validation\ValidationException;

/**
 * Resolve o cadastro de paciente pelo CPF normalizado, usado na criação e na
 * edição de solicitações. Deve rodar dentro da transação de quem chama.
 *
 * Nome e nascimento da solicitação são snapshot histórico e não sobrescrevem
 * o cadastro de um paciente compartilhado. A única exceção é a correção feita
 * na edição de uma solicitação que é a única do paciente: aí o cadastro existe
 * só por causa dela e acompanha a correção.
 */
class LocalizarOuCriarPaciente
{
    /**
     * @param  array{nome_solicitante:string, cpf_solicitante:string, data_nascimento:string, celular?:?string}  $data
     */
    public function execute(array $data, ?Solicitacao $emEdicao = null): Paciente
    {
        $cpf = preg_replace('/\D+/', '', $data['cpf_solicitante']);
        $celular = isset($data['celular']) ? preg_replace('/\D+/', '', $data['celular']) : null;

        $paciente = Paciente::query()->where('cpf', $cpf)->lockForUpdate()->first();

        if ($paciente === null) {
            return Paciente::query()->create([
                'nome' => $data['nome_solicitante'],
                'cpf' => $cpf,
                'data_nascimento' => $data['data_nascimento'],
                'celular' => $celular,
            ]);
        }

        if ($paciente->data_nascimento->toDateString() !== $data['data_nascimento']) {
            if (! $this->cadastroExclusivoDa($paciente, $emEdicao)) {
                throw ValidationException::withMessages([
                    'cpf_solicitante' => ['CPF já cadastrado com outra data de nascimento.'],
                ]);
            }

            $paciente->update([
                'nome' => $data['nome_solicitante'],
                'data_nascimento' => $data['data_nascimento'],
            ]);
        }

        if ($celular !== null && $paciente->celular !== $celular) {
            $paciente->update(['celular' => $celular]);
        }

        return $paciente;
    }

    private function cadastroExclusivoDa(Paciente $paciente, ?Solicitacao $solicitacao): bool
    {
        return $solicitacao !== null
            && $solicitacao->paciente_id === $paciente->id
            && $paciente->solicitacoes()->whereKeyNot($solicitacao->id)->doesntExist();
    }
}
