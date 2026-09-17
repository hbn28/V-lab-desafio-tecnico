<?php

namespace Database\Factories;

use App\Models\Solicitacao;
use Illuminate\Database\Eloquent\Factories\Factory;

class SolicitacaoFactory extends Factory
{
    protected $model = Solicitacao::class;

    public function definition(): array
    {
        $faker      = \Faker\Factory::create('pt_BR');
        $prioridade = $faker->randomElement(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']);

        return [
            'protocolo'               => 'SOL-' . date('Y') . '-' . str_pad($faker->unique()->numberBetween(1, 9999), 4, '0', STR_PAD_LEFT),
            'nome_solicitante'        => $faker->name(),
            'categoria'               => $faker->randomElement(['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO']),
            'prioridade'              => $prioridade,
            'status'                  => 'RECEBIDA',
            'descricao'               => $faker->sentence(12),
            'justificativa_prioridade' => $prioridade === 'URGENTE'
                ? $faker->sentence(8)
                : null,
        ];
    }
}
