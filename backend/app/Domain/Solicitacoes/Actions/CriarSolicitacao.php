<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Paciente;
use App\Models\Solicitacao;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CriarSolicitacao
{
    public function execute(array $data): Solicitacao
    {
        return DB::transaction(function () use ($data) {
            $paciente = $this->localizarOuCriarPaciente($data);
            $protocolo = $this->gerarProtocolo();

            $solicitacao = Solicitacao::create([
                'paciente_id' => $paciente->id,
                'protocolo' => $protocolo,
                'nome_solicitante' => $data['nome_solicitante'],
                'cpf_solicitante' => $data['cpf_solicitante'],
                'data_nascimento' => $data['data_nascimento'],
                'categoria' => $data['categoria'],
                'prioridade' => $data['prioridade'],
                'status' => 'RECEBIDA',
                'descricao' => $data['descricao'],
                'justificativa_prioridade' => $data['justificativa_prioridade'] ?? null,
            ]);

            $solicitacao->setRelation('paciente', $paciente);

            return $solicitacao;
        });
    }

    /**
     * Localiza o paciente pelo CPF normalizado (fotografia atual do cadastro),
     * ou cria um novo. Nome e nascimento da solicitação permanecem apenas como
     * snapshot histórico e nunca sobrescrevem o cadastro do paciente.
     */
    private function localizarOuCriarPaciente(array $data): Paciente
    {
        $cpf = preg_replace('/\D+/', '', $data['cpf_solicitante']);
        $celular = isset($data['celular']) ? preg_replace('/\D+/', '', $data['celular']) : null;

        $paciente = Paciente::query()->where('cpf', $cpf)->lockForUpdate()->first();

        if ($paciente !== null && $paciente->data_nascimento->toDateString() !== $data['data_nascimento']) {
            throw ValidationException::withMessages([
                'cpf_solicitante' => ['CPF já cadastrado com outra data de nascimento.'],
            ]);
        }

        if ($paciente === null) {
            return Paciente::query()->create([
                'nome' => $data['nome_solicitante'],
                'cpf' => $cpf,
                'data_nascimento' => $data['data_nascimento'],
                'celular' => $celular,
            ]);
        }

        if ($celular !== null && $paciente->celular !== $celular) {
            $paciente->update(['celular' => $celular]);
        }

        return $paciente;
    }

    private function gerarProtocolo(): string
    {
        $ano = (int) now()->utc()->format('Y');

        DB::statement(
            'INSERT INTO protocolo_counters (ano, ultimo_numero) VALUES (?, 0) ON CONFLICT (ano) DO NOTHING',
            [$ano]
        );

        $counter = DB::table('protocolo_counters')
            ->where('ano', $ano)
            ->lockForUpdate()
            ->first();

        $numero = $counter->ultimo_numero + 1;

        DB::table('protocolo_counters')
            ->where('ano', $ano)
            ->update(['ultimo_numero' => $numero]);

        return sprintf('SOL-%d-%04d', $ano, $numero);
    }
}
