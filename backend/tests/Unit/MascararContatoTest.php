<?php

use App\Domain\Solicitacoes\Support\MascararContato;

it('mascara CPF válido e não expõe valor ausente ou malformado', function () {
    expect(MascararContato::cpf('123.456.789-00'))->toBe('***.456.789-**')
        ->and(MascararContato::cpf(null))->toBe('***.***.***-**')
        ->and(MascararContato::cpf('malformado'))->toBe('***.***.***-**');
});
