<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('solicitacoes', function (Blueprint $table) {
            $table->timestampTz('agendado_para')->nullable()->index();
        });

        // Registros legados AGENDADA não possuem horário real: voltam a EM_ANALISE, sem inventar data.
        DB::table('solicitacoes')->where('status', 'AGENDADA')->update([
            'status' => 'EM_ANALISE',
            'agendado_para' => null,
        ]);

        DB::statement("ALTER TABLE solicitacoes ADD CONSTRAINT chk_agendada_com_horario CHECK (status <> 'AGENDADA' OR agendado_para IS NOT NULL)");
        DB::statement("ALTER TABLE solicitacoes ADD CONSTRAINT chk_estado_inicial_sem_horario CHECK (status NOT IN ('RECEBIDA','EM_ANALISE') OR agendado_para IS NULL)");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS chk_estado_inicial_sem_horario');
        DB::statement('ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS chk_agendada_com_horario');

        Schema::table('solicitacoes', function (Blueprint $table) {
            $table->dropIndex(['agendado_para']);
            $table->dropColumn('agendado_para');
        });
    }
};
