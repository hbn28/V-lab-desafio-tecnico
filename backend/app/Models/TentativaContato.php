<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TentativaContato extends Model
{
    use HasFactory;

    protected $table = 'tentativas_contato';

    protected $fillable = [
        'agendamento_id',
        'resultado',
        'realizada_em',
    ];

    protected $casts = [
        'realizada_em' => 'immutable_datetime',
    ];

    public function agendamento(): BelongsTo
    {
        return $this->belongsTo(Agendamento::class);
    }
}
