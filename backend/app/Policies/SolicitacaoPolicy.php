<?php

namespace App\Policies;

use App\Models\Solicitacao;
use App\Models\User;

class SolicitacaoPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active;
    }

    public function view(User $user, Solicitacao $solicitacao): bool
    {
        return $user->is_active;
    }

    public function create(User $user): bool
    {
        return $user->is_active;
    }

    public function update(User $user, Solicitacao $solicitacao): bool
    {
        return $user->is_active;
    }

    public function delete(User $user, Solicitacao $solicitacao): bool
    {
        return $user->is_active && $user->role === 'ADMINISTRADOR';
    }
}
