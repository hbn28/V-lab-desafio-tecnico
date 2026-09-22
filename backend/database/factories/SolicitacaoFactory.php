<?php

namespace Database\Factories;

use App\Models\Paciente;
use App\Models\Solicitacao;
use Illuminate\Database\Eloquent\Factories\Factory;

class SolicitacaoFactory extends Factory
{
    protected $model = Solicitacao::class;

    public function configure(): static
    {
        // Se um teste sobrescrever 'prioridade' via ->create([...]), a justificativa
        // calculada aqui em definition() (com a prioridade sorteada internamente) fica
        // dessincronizada. Resolve depois que os overrides já foram aplicados.
        return $this->afterMaking(function (Solicitacao $solicitacao): void {
            if ($solicitacao->prioridade === 'URGENTE' && ! $solicitacao->justificativa_prioridade) {
                $solicitacao->justificativa_prioridade = \Faker\Factory::create('pt_BR')->sentence(8);
            } elseif ($solicitacao->prioridade !== 'URGENTE') {
                $solicitacao->justificativa_prioridade = null;
            }
        });
    }

    public function definition(): array
    {
        $faker = \Faker\Factory::create('pt_BR');
        $prioridade = $faker->randomElement(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']);

        // CPF fictício no formato 000.000.000-00
        $cpf = sprintf(
            '%03d.%03d.%03d-%02d',
            $faker->numberBetween(100, 999),
            $faker->numberBetween(100, 999),
            $faker->numberBetween(100, 999),
            $faker->numberBetween(10, 99)
        );

        return [
            'paciente_id' => Paciente::factory(),
            'protocolo' => 'SOL-'.date('Y').'-'.str_pad($faker->unique()->numberBetween(1, 9999), 4, '0', STR_PAD_LEFT),
            'nome_solicitante' => $faker->name(),
            'cpf_solicitante' => $cpf,
            'data_nascimento' => $faker->dateTimeBetween('-80 years', '-18 years')->format('Y-m-d'),
            'categoria' => $faker->randomElement(['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO']),
            'prioridade' => $prioridade,
            'status' => 'RECEBIDA',
            'agendado_para' => null,
            'descricao' => $faker->sentence(12),
            'justificativa_prioridade' => $prioridade === 'URGENTE'
                ? $faker->sentence(8)
                : null,
        ];
    }
}
