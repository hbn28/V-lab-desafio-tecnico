<?php

namespace App\Domain\Auth\Console;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CriarOperador extends Command
{
    protected $signature = 'operadores:criar';

    protected $description = 'Cria uma conta administrativa interativamente';

    public function handle(): int
    {
        $username = $this->ask('Usuário');
        $email = $this->ask('E-mail (opcional)');
        $password = $this->secret('Senha', false);
        $confirmation = $this->secret('Confirme a senha', false);

        $validator = Validator::make([
            'username' => $username,
            'email' => $email ?: null,
            'password' => $password,
            'password_confirmation' => $confirmation,
        ], [
            'username' => ['required', 'string', 'min:3', 'max:255', 'regex:/^[a-zA-Z0-9._-]+$/', Rule::unique('users', 'username')],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'confirmed'],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->keys() as $field) {
                $this->error(match ($field) {
                    'username' => 'Usuário inválido ou já cadastrado (mínimo de 3 caracteres; use letras, números, ponto, hífen ou sublinhado).',
                    'email' => 'E-mail inválido ou já cadastrado.',
                    default => 'Senha vazia ou confirmação diferente.',
                });
            }

            return self::FAILURE;
        }

        User::create([
            'name' => $username,
            'username' => $username,
            'email' => $email ?: null,
            'password' => Hash::make($password),
            'role' => 'ADMINISTRADOR',
            'is_active' => true,
        ]);

        $this->info('Operador criado com sucesso.');

        return self::SUCCESS;
    }
}
