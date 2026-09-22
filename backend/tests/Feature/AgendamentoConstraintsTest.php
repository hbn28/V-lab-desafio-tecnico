<?php

use App\Models\Solicitacao;
use Illuminate\Support\Facades\DB;

test('banco aceita duas solicitações no mesmo horário', function () {
    $data = ['status' => 'AGENDADA', 'agendado_para' => '2026-09-25 17:30:00+00'];
    Solicitacao::factory()->count(2)->create($data);
    expect(Solicitacao::where('agendado_para', $data['agendado_para'])->count())->toBe(2);
});

test('estados terminais legados aceitam horário nulo', function (string $status) {
    $solicitacao = Solicitacao::factory()->create([
        'status' => $status,
        'agendado_para' => null,
    ]);
    expect($solicitacao->exists)->toBeTrue();
})->with(['CONCLUIDA', 'CANCELADA']);

test('migration devolve AGENDADA legada para EM_ANALISE sem inventar horário', function () {
    $migration = require database_path('migrations/2026_09_21_000003_add_agendado_para_to_solicitacoes_table.php');
    $migration->down();

    // Linha legada: a coluna não existe neste ponto, então a factory não pode ser usada.
    $dados = Solicitacao::factory()->raw(['status' => 'AGENDADA']);
    unset($dados['agendado_para']);
    $id = DB::table('solicitacoes')->insertGetId($dados + ['created_at' => now(), 'updated_at' => now()]);

    $migration->up();

    $legada = Solicitacao::findOrFail($id);
    expect($legada->status)->toBe('EM_ANALISE')
        ->and($legada->agendado_para)->toBeNull();
});
