<?php

namespace App\Domain\Solicitacoes\Support;

use Carbon\CarbonImmutable;
use DateTimeZone;

final class HorarioAgendamento
{
    /**
     * Converte data/hora locais em um instante UTC. Retorna null quando a entrada
     * é inválida ou quando o horário local não existe ou é ambíguo no fuso
     * (mudança de offset), sem normalizar silenciosamente.
     */
    public static function interpretarLocal(string $data, string $hora, string $timezone): ?CarbonImmutable
    {
        $zona = new DateTimeZone($timezone);
        $parede = CarbonImmutable::createFromFormat('!Y-m-d H:i', "$data $hora", 'UTC');

        if ($parede === false || $parede->format('Y-m-d H:i') !== "$data $hora") {
            return null;
        }

        $offsets = collect($zona->getTransitions($parede->timestamp - 86400, $parede->timestamp + 86400))
            ->pluck('offset')->unique()->values();

        $candidatos = $offsets->map(
            fn (int $offset) => CarbonImmutable::createFromTimestamp($parede->timestamp - $offset, 'UTC')
        )->filter(
            fn (CarbonImmutable $instante) => $instante->setTimezone($zona)->format('Y-m-d H:i') === "$data $hora"
        )->unique(fn (CarbonImmutable $instante) => $instante->timestamp)->values();

        return $candidatos->count() === 1 ? $candidatos->first()->utc() : null;
    }

    /**
     * Intervalo UTC semiaberto [início do dia local, início do dia local seguinte).
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public static function limitesUtcDoDia(string $data, string $timezone): array
    {
        $inicioLocal = CarbonImmutable::createFromFormat('!Y-m-d', $data, $timezone)->startOfDay();

        return [$inicioLocal->utc(), $inicioLocal->addDay()->utc()];
    }
}
