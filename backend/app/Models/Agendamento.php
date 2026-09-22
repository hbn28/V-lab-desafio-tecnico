<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Agendamento extends Model
{
    use HasFactory;

    protected $table = 'agendamentos';

    protected $fillable = [
        'solicitacao_id',
        'data_agendada',
        'modalidade',
        'hora_agendada',
        'turno',
        'status',
        'resultado_em',
        'falta_registrada_em',
        'falta_corrigida_em',
    ];

    protected $casts = [
        'data_agendada' => 'date:Y-m-d',
        'resultado_em' => 'immutable_datetime',
        'falta_registrada_em' => 'immutable_datetime',
        'falta_corrigida_em' => 'immutable_datetime',
    ];

    public function solicitacao(): BelongsTo
    {
        return $this->belongsTo(Solicitacao::class);
    }

    public function tentativasContato(): HasMany
    {
        return $this->hasMany(TentativaContato::class);
    }

    public function ultimaTentativaContato(): HasOne
    {
        return $this->hasOne(TentativaContato::class)->latestOfMany('realizada_em');
    }
}
