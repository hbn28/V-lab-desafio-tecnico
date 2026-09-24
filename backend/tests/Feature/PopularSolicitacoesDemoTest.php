<?php

use App\Models\Agendamento;
use App\Models\EntradaFila;
use App\Models\Solicitacao;
use App\Models\TentativaContato;

test('carga fictícia cria exatamente 500 solicitações com identificadores aleatórios de oito dígitos', function () {
    $this->artisan('solicitacoes:popular-demonstracao')->assertExitCode(0);

    $registros = Solicitacao::query()->where('descricao', 'like', '[DEMO-500]%')->get();
    expect($registros)->toHaveCount(500)
        ->and($registros->pluck('id')->unique())->toHaveCount(500)
        ->and($registros->pluck('protocolo')->unique())->toHaveCount(500)
        ->and($registros->pluck('categoria')->unique())->toHaveCount(4)
        ->and($registros->pluck('prioridade')->unique())->toHaveCount(4)
        ->and($registros->pluck('status')->unique())->toHaveCount(5);

    foreach ($registros as $registro) {
        expect((string) $registro->id)->toMatch('/^[1-9][0-9]{7}$/')
            ->and($registro->protocolo)->toMatch('/^[1-9][0-9]{7}$/')
            ->and($registro->paciente_id)->not->toBeNull()
            ->and($registro->nome_solicitante)->toStartWith('[DEMO] ');
    }

    expect(Agendamento::query()->whereIn('solicitacao_id', $registros->pluck('id'))->count())->toBeGreaterThan(0)
        ->and(Agendamento::query()->whereIn('solicitacao_id', $registros->pluck('id'))->where('status', 'FALTA')->count())->toBeGreaterThan(0)
        ->and(TentativaContato::query()->whereHas('agendamento', fn ($query) => $query->whereIn('solicitacao_id', $registros->pluck('id')))->count())->toBeGreaterThan(0)
        ->and(EntradaFila::query()->whereIn('solicitacao_id', $registros->pluck('id'))->count())->toBeGreaterThan(0);
});

test('reexecutar carga fictícia não duplica registros', function () {
    $this->artisan('solicitacoes:popular-demonstracao')->assertExitCode(0);
    $this->artisan('solicitacoes:popular-demonstracao')->assertExitCode(0);

    expect(Solicitacao::query()->where('descricao', 'like', '[DEMO-500]%')->count())->toBe(500);
});
