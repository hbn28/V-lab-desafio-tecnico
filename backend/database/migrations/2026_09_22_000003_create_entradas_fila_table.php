<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entradas_fila', function (Blueprint $table) {
            $table->id();
            $table->foreignId('solicitacao_id')->constrained('solicitacoes')->cascadeOnDelete();
            $table->timestampTz('entrou_em');
            $table->timestampTz('encerrada_em')->nullable();
            $table->string('motivo_encerramento')->nullable();
            $table->timestamps();
        });

        DB::statement("ALTER TABLE entradas_fila ADD CONSTRAINT chk_motivo_encerramento CHECK (motivo_encerramento IS NULL OR motivo_encerramento IN ('AGENDAMENTO','CANCELAMENTO'))");
        DB::statement('CREATE UNIQUE INDEX entradas_fila_aberta_unique ON entradas_fila (solicitacao_id) WHERE encerrada_em IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('entradas_fila');
    }
};
