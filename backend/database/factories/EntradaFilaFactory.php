<?php

namespace Database\Factories;

use App\Models\EntradaFila;
use App\Models\Solicitacao;
use Illuminate\Database\Eloquent\Factories\Factory;

class EntradaFilaFactory extends Factory
{
    protected $model = EntradaFila::class;

    public function definition(): array
    {
        return [
            'solicitacao_id' => Solicitacao::factory(),
            'entrou_em' => now(),
            'encerrada_em' => null,
            'motivo_encerramento' => null,
        ];
    }
}
