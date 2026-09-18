<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('solicitacoes', function (Blueprint $table) {
            $table->id();
            $table->string('protocolo')->unique();
            $table->string('nome_solicitante', 255);
            $table->string('cpf_solicitante', 14);
            $table->date('data_nascimento');
            $table->string('categoria');
            $table->string('prioridade');
            $table->string('status');
            $table->text('descricao');
            $table->text('justificativa_prioridade')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('categoria');
            $table->index('prioridade');
        });

        DB::statement("ALTER TABLE solicitacoes ADD CONSTRAINT chk_categoria CHECK (categoria IN ('CONSULTA','EXAME','VACINACAO','OUTRO'))");
        DB::statement("ALTER TABLE solicitacoes ADD CONSTRAINT chk_prioridade CHECK (prioridade IN ('BAIXA','MEDIA','ALTA','URGENTE'))");
        DB::statement("ALTER TABLE solicitacoes ADD CONSTRAINT chk_status CHECK (status IN ('RECEBIDA','EM_ANALISE','AGENDADA','CONCLUIDA','CANCELADA'))");
        DB::statement("ALTER TABLE solicitacoes ADD CONSTRAINT chk_justificativa_urgente CHECK (prioridade <> 'URGENTE' OR (justificativa_prioridade IS NOT NULL AND btrim(justificativa_prioridade) <> ''))");
    }

    public function down(): void
    {
        Schema::dropIfExists('solicitacoes');
    }
};
