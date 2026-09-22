<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agendamentos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('solicitacao_id')->constrained('solicitacoes')->cascadeOnDelete();
            $table->date('data_agendada');
            $table->string('modalidade');
            $table->time('hora_agendada')->nullable();
            $table->string('turno');
            $table->string('status');
            $table->timestampTz('resultado_em')->nullable();
            $table->timestampTz('falta_registrada_em')->nullable();
            $table->timestampTz('falta_corrigida_em')->nullable();
            $table->timestamps();

            $table->index(['data_agendada', 'turno', 'hora_agendada']);
            $table->index('status');
        });

        DB::statement("ALTER TABLE agendamentos ADD CONSTRAINT chk_modalidade CHECK (modalidade IN ('HORARIO','TURNO'))");
        DB::statement("ALTER TABLE agendamentos ADD CONSTRAINT chk_turno CHECK (turno IN ('MANHA','TARDE','NOITE'))");
        DB::statement("ALTER TABLE agendamentos ADD CONSTRAINT chk_status_agendamento CHECK (status IN ('AGENDADO','REALIZADO','FALTA','CANCELADO'))");
        DB::statement("ALTER TABLE agendamentos ADD CONSTRAINT chk_modalidade_hora CHECK ((modalidade = 'HORARIO' AND hora_agendada IS NOT NULL AND turno IS NOT NULL) OR (modalidade = 'TURNO' AND hora_agendada IS NULL AND turno IS NOT NULL))");
        DB::statement("CREATE UNIQUE INDEX agendamento_ativo_unique ON agendamentos (solicitacao_id) WHERE status = 'AGENDADO'");
    }

    public function down(): void
    {
        Schema::dropIfExists('agendamentos');
    }
};
