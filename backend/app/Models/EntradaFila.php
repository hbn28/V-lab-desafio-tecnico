<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EntradaFila extends Model
{
    use HasFactory;

    protected $table = 'entradas_fila';

    protected $fillable = [
        'solicitacao_id',
        'entrou_em',
        'encerrada_em',
        'motivo_encerramento',
    ];

    protected $casts = [
        'entrou_em' => 'immutable_datetime',
        'encerrada_em' => 'immutable_datetime',
    ];

    public function solicitacao(): BelongsTo
    {
        return $this->belongsTo(Solicitacao::class);
    }
}
