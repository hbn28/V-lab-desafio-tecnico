<?php

namespace App\Domain\Auth\Console;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class CriarOperador extends Command
{
    protected $signature = 'operadores:criar';

    protected $description = 'Cria uma conta administrativa interativamente';

    public function handle(): int
    {
        $name = $this->ask('Nome');
        $email = $this->ask('E-mail');
        $password = $this->secret('Senha', false);
        $confirmation = $this->secret('Confirme a senha', false);

        $validator = Validator::make([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'password_confirmation' => $confirmation,
        ], [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);

        if ($validator->fails()) {
            $this->error('Dados inválidos. Verifique nome, e-mail único e senha de pelo menos 12 caracteres com maiúscula, minúscula, número e símbolo.');

            return self::FAILURE;
        }

        User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'role' => 'ADMINISTRADOR',
            'is_active' => true,
        ]);

        $this->info('Operador criado com sucesso.');

        return self::SUCCESS;
    }
}
