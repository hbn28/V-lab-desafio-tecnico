<?php

use App\Models\Paciente;
use App\Models\Solicitacao;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('solicitacoes', function (Blueprint $table) {
            $table->foreignId('paciente_id')->nullable()->after('id')->constrained('pacientes')->restrictOnDelete();
        });

        // Cria/reaproveita um paciente por CPF normalizado a partir do snapshot
        // já existente em solicitacoes, sem inventar dado novo.
        Solicitacao::query()->whereNull('paciente_id')->orderBy('id')->each(function (Solicitacao $solicitacao): void {
            $cpfNormalizado = preg_replace('/\D/', '', (string) $solicitacao->cpf_solicitante);

            $paciente = Paciente::query()->firstOrCreate(
                ['cpf' => $cpfNormalizado],
                [
                    'nome' => $solicitacao->nome_solicitante,
                    'data_nascimento' => $solicitacao->data_nascimento,
                ]
            );

            $solicitacao->forceFill(['paciente_id' => $paciente->id])->saveQuietly();
        });

        DB::statement('ALTER TABLE solicitacoes ALTER COLUMN paciente_id SET NOT NULL');
    }

    public function down(): void
    {
        Schema::table('solicitacoes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('paciente_id');
        });
    }
};
