<?php

namespace App\Domain\Solicitacoes\Support;

final class MascararContato
{
    /**
     * Mascara um celular normalizado (10 ou 11 dígitos), preservando DDD e os
     * últimos 4 dígitos: 81999990000 -> "(81) *****-0000".
     */
    public static function celular(?string $celular): ?string
    {
        $digitos = $celular === null ? '' : preg_replace('/\D+/', '', $celular);

        if ($digitos === '' || strlen($digitos) < 10) {
            return null;
        }

        $ddd = substr($digitos, 0, 2);
        $resto = substr($digitos, 2);
        $sufixo = substr($resto, -4);
        $prefixo = str_repeat('*', strlen($resto) - 4);

        return sprintf('(%s) %s-%s', $ddd, $prefixo, $sufixo);
    }
}
