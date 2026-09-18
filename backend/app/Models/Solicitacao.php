<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Solicitacao extends Model
{
    use HasFactory;

    protected $table = 'solicitacoes';

    protected $fillable = [
        'protocolo',
        'nome_solicitante',
        'cpf_solicitante',
        'data_nascimento',
        'categoria',
        'prioridade',
        'status',
        'descricao',
        'justificativa_prioridade',
    ];

    protected $casts = [
        'data_nascimento' => 'date',
        'created_at'      => 'datetime',
        'updated_at'      => 'datetime',
    ];
}
