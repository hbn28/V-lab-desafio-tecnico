<?php

return [
    // Permite que qualquer pessoa crie uma conta pela tela de login. Contas criadas
    // assim são sempre ATENDENTE (nunca ADMINISTRADOR). Desligue com
    // CADASTRO_PUBLICO=false para aceitar apenas contas criadas por `operadores:criar`.
    'publico' => (bool) env('CADASTRO_PUBLICO', true),
];
