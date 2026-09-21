<?php

use App\Domain\Solicitacoes\Support\HorarioAgendamento;

test('interpreta horário do Recife e devolve UTC', function () {
    $instante = HorarioAgendamento::interpretarLocal('2026-09-25', '14:30', 'America/Recife');
    expect($instante?->toIso8601String())->toBe('2026-09-25T17:30:00+00:00');
});

test('rejeita horário local inexistente ou ambíguo', function (string $data, string $hora) {
    expect(HorarioAgendamento::interpretarLocal($data, $hora, 'America/New_York'))->toBeNull();
})->with([
    ['2026-03-08', '02:30'],
    ['2026-11-01', '01:30'],
]);

test('calcula intervalo UTC semiaberto do dia operacional', function () {
    [$inicio, $fim] = HorarioAgendamento::limitesUtcDoDia('2026-09-25', 'America/Recife');
    expect($inicio->toIso8601String())->toBe('2026-09-25T03:00:00+00:00')
        ->and($fim->toIso8601String())->toBe('2026-09-26T03:00:00+00:00');
});
