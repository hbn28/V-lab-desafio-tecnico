<?php

namespace App\Domain\Solicitacoes\Exceptions;

use RuntimeException;

/**
 * A operação é válida em formato, mas conflita com o estado atual do recurso
 * (transição de status proibida, agendamento que já não está ativo etc.).
 *
 * As Actions lançam esta exceção sem conhecer HTTP; bootstrap/app.php a
 * traduz para 409 no formato padrão { message, errors }.
 */
class ConflitoDeEstado extends RuntimeException {}
