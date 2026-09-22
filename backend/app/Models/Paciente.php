<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Paciente extends Model
{
    use HasFactory;

    protected $table = 'pacientes';

    protected $fillable = [
        'nome',
        'cpf',
        'data_nascimento',
        'celular',
    ];

    protected $casts = [
        'data_nascimento' => 'date',
    ];

    public function solicitacoes(): HasMany
    {
        return $this->hasMany(Solicitacao::class);
    }
}
