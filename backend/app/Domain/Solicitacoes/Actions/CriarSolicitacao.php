<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Solicitacao;
use Illuminate\Support\Facades\DB;

class CriarSolicitacao
{
    public function __construct(private readonly LocalizarOuCriarPaciente $localizarOuCriarPaciente) {}

    public function execute(array $data): Solicitacao
    {
        return DB::transaction(function () use ($data) {
            $paciente = $this->localizarOuCriarPaciente->execute($data);
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
