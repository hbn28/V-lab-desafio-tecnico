<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tentativas_contato', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agendamento_id')->constrained('agendamentos')->cascadeOnDelete();
            $table->string('resultado');
            $table->timestampTz('realizada_em');
            $table->timestamps();

            $table->index(['agendamento_id', 'realizada_em']);
        });

        DB::statement("ALTER TABLE tentativas_contato ADD CONSTRAINT chk_resultado_contato CHECK (resultado IN ('SEM_RESPOSTA','RECADO','CONFIRMOU_RETORNO','NUMERO_INVALIDO'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('tentativas_contato');
    }
};
