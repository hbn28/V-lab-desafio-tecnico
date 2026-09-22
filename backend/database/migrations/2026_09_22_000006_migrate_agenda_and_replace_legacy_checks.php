<?php

use App\Domain\Solicitacoes\Support\TurnoAgendamento;
use App\Models\Agendamento;
use App\Models\Solicitacao;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $timezone = config('agendamento.timezone', 'America/Recife');

        // Cada agendado_para legado vira um Agendamento HORARIO, preservando o
        // desfecho real (REALIZADO/CANCELADO/AGENDADO) conforme o status atual.
        Solicitacao::query()->whereNotNull('agendado_para')->orderBy('id')->each(function (Solicitacao $solicitacao) use ($timezone): void {
            $local = $solicitacao->agendado_para->setTimezone($timezone);
            $hora = $local->format('H:i');

            Agendamento::query()->create([
                'solicitacao_id' => $solicitacao->id,
                'data_agendada' => $local->toDateString(),
                'modalidade' => 'HORARIO',
                'hora_agendada' => $hora,
                'turno' => TurnoAgendamento::derivarDaHora($hora),
                'status' => match ($solicitacao->status) {
                    'CONCLUIDA' => 'REALIZADO',
                    'CANCELADA' => 'CANCELADO',
                    default => 'AGENDADO',
                },
                'resultado_em' => in_array($solicitacao->status, ['CONCLUIDA', 'CANCELADA'], true)
                    ? $solicitacao->updated_at
                    : null,
            ]);
        });

        // Solicitações já em EM_ANALISE ganham uma entrada de fila aberta,
        // como se tivessem acabado de transitar de RECEBIDA.
        Solicitacao::query()->where('status', 'EM_ANALISE')->orderBy('id')->each(function (Solicitacao $solicitacao): void {
            DB::table('entradas_fila')->insert([
                'solicitacao_id' => $solicitacao->id,
                'entrou_em' => $solicitacao->updated_at,
                'encerrada_em' => null,
                'motivo_encerramento' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        // A partir de agora, a existência de um agendamento ativo (validada em
        // Action, não em CHECK entre tabelas) substitui os CHECKs legados.
        DB::statement('ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS chk_agendada_com_horario');
        DB::statement('ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS chk_estado_inicial_sem_horario');
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE solicitacoes ADD CONSTRAINT chk_agendada_com_horario CHECK (status <> 'AGENDADA' OR agendado_para IS NOT NULL)");
        DB::statement("ALTER TABLE solicitacoes ADD CONSTRAINT chk_estado_inicial_sem_horario CHECK (status NOT IN ('RECEBIDA','EM_ANALISE') OR agendado_para IS NULL)");
    }
};
