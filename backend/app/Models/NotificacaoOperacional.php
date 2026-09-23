<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotificacaoOperacional extends Model
{
    protected $table = 'notificacoes_operacionais';

    protected $fillable = [
        'event_id', 'request_id', 'user_id', 'solicitacao_id', 'protocolo',
        'status_anterior', 'status_novo', 'read_at',
    ];

    protected $casts = ['read_at' => 'immutable_datetime'];
}
