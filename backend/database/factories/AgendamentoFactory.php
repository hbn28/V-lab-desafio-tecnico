<?php

namespace Database\Factories;

use App\Models\Agendamento;
use App\Models\Solicitacao;
use Illuminate\Database\Eloquent\Factories\Factory;

class AgendamentoFactory extends Factory
{
    protected $model = Agendamento::class;

    public function definition(): array
    {
        return [
            'solicitacao_id' => Solicitacao::factory(),
            'data_agendada' => now()->addDay()->toDateString(),
            'modalidade' => 'TURNO',
            'hora_agendada' => null,
            'turno' => 'MANHA',
            'status' => 'AGENDADO',
            'resultado_em' => null,
            'falta_registrada_em' => null,
            'falta_corrigida_em' => null,
        ];
    }
}
