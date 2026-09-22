<?php

namespace App\Domain\Solicitacoes\Support;

use Carbon\CarbonImmutable;

final class TurnoAgendamento
{
    public const TURNOS = ['MANHA', 'TARDE', 'NOITE'];

    public static function derivarDaHora(string $hora): string
    {
        [$h] = array_map('intval', explode(':', $hora));

        return match (true) {
            $h >= 6 && $h < 12 => 'MANHA',
            $h >= 12 && $h < 18 => 'TARDE',
            default => 'NOITE',
        };
    }

    /**
     * Instante UTC em que um período (turno) termina para uma data local.
     * MANHA termina 12:00, TARDE termina 18:00, NOITE termina 06:00 do dia seguinte.
     */
    public static function fimDoTurnoUtc(string $data, string $turno, string $timezone): CarbonImmutable
    {
        $base = CarbonImmutable::createFromFormat('!Y-m-d', $data, $timezone);

        $fimLocal = match ($turno) {
            'MANHA' => $base->setTime(12, 0),
            'TARDE' => $base->setTime(18, 0),
            'NOITE' => $base->addDay()->setTime(6, 0),
            default => throw new \InvalidArgumentException("Turno inválido: {$turno}"),
        };

        return $fimLocal->utc();
    }
}
