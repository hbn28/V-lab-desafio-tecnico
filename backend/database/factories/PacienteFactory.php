<?php

namespace Database\Factories;

use App\Models\Paciente;
use Illuminate\Database\Eloquent\Factories\Factory;

class PacienteFactory extends Factory
{
    protected $model = Paciente::class;

    public function definition(): array
    {
        $faker = \Faker\Factory::create('pt_BR');

        return [
            'nome' => $faker->name(),
            'cpf' => $faker->unique()->numerify('###########'),
            'data_nascimento' => $faker->dateTimeBetween('-80 years', '-18 years')->format('Y-m-d'),
            'celular' => $faker->numerify('###########'),
        ];
    }
}
