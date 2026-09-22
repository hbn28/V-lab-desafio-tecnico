<?php

use App\Models\Agendamento;
use App\Models\EntradaFila;
use App\Models\Paciente;
use App\Models\Solicitacao;
use Database\Seeders\SolicitacoesSeeder;

test('dados fictícios permanecem coerentes e idempotentes', function () {
    $this->seed(SolicitacoesSeeder::class);
    $this->seed(SolicitacoesSeeder::class);

    expect(Solicitacao::count())->toBe(10)
        ->and(Paciente::count())->toBe(10)
        ->and(Agendamento::where('status', 'AGENDADO')->count())->toBe(2)
        ->and(EntradaFila::whereNull('encerrada_em')->count())->toBe(2)
        ->and(Solicitacao::where('status', 'AGENDADA')->doesntHave('agendamentoAtivo')->count())->toBe(0)
        ->and(Solicitacao::where('status', 'EM_ANALISE')->doesntHave('entradaFilaAberta')->count())->toBe(0);
});
