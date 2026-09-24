<?php

namespace App\Domain\Auth\Actions;

use App\Models\User;

class CadastrarOperador
{
    /** @param array{name:string, username:string, email?:?string, password:string} $dados */
    public function execute(array $dados): User
    {
        return User::create([
            'name' => $dados['name'],
            'username' => $dados['username'],
            'email' => $dados['email'] ?? null,
            'password' => $dados['password'],
            'role' => 'ATENDENTE',
            'is_active' => true,
        ]);
    }
}
