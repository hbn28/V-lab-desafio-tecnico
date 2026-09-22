<?php

namespace Database\Factories;

use App\Models\Agendamento;
use App\Models\TentativaContato;
use Illuminate\Database\Eloquent\Factories\Factory;

class TentativaContatoFactory extends Factory
{
    protected $model = TentativaContato::class;

    public function definition(): array
    {
        return [
            'agendamento_id' => Agendamento::factory(),
            'resultado' => 'SEM_RESPOSTA',
            'realizada_em' => now(),
        ];
    }
}
