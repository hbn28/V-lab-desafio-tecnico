<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Solicitacao extends Model
{
    use HasFactory;

    protected $table = 'solicitacoes';

    protected $fillable = [
        'paciente_id',
        'protocolo',
        'nome_solicitante',
        'cpf_solicitante',
        'data_nascimento',
        'categoria',
        'prioridade',
        'status',
        'descricao',
        'justificativa_prioridade',
        'agendado_para',
    ];

    protected $casts = [
        'data_nascimento' => 'date',
        'agendado_para' => 'immutable_datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function paciente(): BelongsTo
    {
        return $this->belongsTo(Paciente::class);
    }

    public function entradasFila(): HasMany
    {
        return $this->hasMany(EntradaFila::class);
    }

    public function entradaFilaAberta(): HasOne
    {
        return $this->hasOne(EntradaFila::class)->whereNull('encerrada_em');
    }

    public function agendamentos(): HasMany
    {
        return $this->hasMany(Agendamento::class);
    }

    public function agendamentoAtivo(): HasOne
    {
        return $this->hasOne(Agendamento::class)->where('status', 'AGENDADO');
    }
}
