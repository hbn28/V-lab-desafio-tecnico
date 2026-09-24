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

    /**
     * Mascara um CPF mantendo só os 6 dígitos centrais, no padrão usado em
     * documentos públicos: 123.456.789-00 -> "***.456.789-**".
     */
    public static function cpf(?string $cpf): ?string
    {
        $digitos = $cpf === null ? '' : preg_replace('/\D+/', '', $cpf);

        if (strlen($digitos) !== 11) {
            return null;
        }

        return sprintf('***.%s.%s-**', substr($digitos, 3, 3), substr($digitos, 6, 3));
    }
}
