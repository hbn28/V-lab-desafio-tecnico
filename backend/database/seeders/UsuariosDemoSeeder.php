<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UsuariosDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        foreach ([
            ['DEMO_ADMIN_EMAIL', 'DEMO_ADMIN_PASSWORD', 'ADMINISTRADOR', 'Administrador de demonstração'],
            ['DEMO_ATTENDANT_EMAIL', 'DEMO_ATTENDANT_PASSWORD', 'ATENDENTE', 'Atendente de demonstração'],
        ] as [$emailKey, $passwordKey, $role, $name]) {
            $email = env($emailKey);
            $password = env($passwordKey);
            if (! is_string($email) || $email === '' || ! is_string($password) || $password === '') {
                continue;
            }

            User::firstOrCreate(
                ['email' => $email],
                ['name' => $name, 'password' => Hash::make($password), 'role' => $role, 'is_active' => true]
            );
        }
    }
}
