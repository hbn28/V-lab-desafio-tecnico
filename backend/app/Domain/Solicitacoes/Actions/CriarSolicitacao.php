<?php

namespace App\Domain\Solicitacoes\Actions;

use App\Models\Solicitacao;
use Illuminate\Support\Facades\DB;

class CriarSolicitacao
{
    public function execute(array $data): Solicitacao
    {
        return DB::transaction(function () use ($data) {
            $protocolo = $this->gerarProtocolo();

            return Solicitacao::create([
                'protocolo'               => $protocolo,
                'nome_solicitante'        => $data['nome_solicitante'],
                'categoria'               => $data['categoria'],
                'prioridade'              => $data['prioridade'],
                'status'                  => 'RECEBIDA',
                'descricao'               => $data['descricao'],
                'justificativa_prioridade' => $data['justificativa_prioridade'] ?? null,
            ]);
        });
    }

    private function gerarProtocolo(): string
    {
        $ano = (int) now()->utc()->format('Y');

        // Garante que a linha do ano existe sem duplicar
        DB::statement(
            'INSERT INTO protocolo_counters (ano, ultimo_numero) VALUES (?, 0) ON CONFLICT (ano) DO NOTHING',
            [$ano]
        );

        // Lê e incrementa com lock exclusivo
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
