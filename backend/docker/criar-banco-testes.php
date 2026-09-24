<?php

/*
 * Garante que o banco da suíte de testes (DB_DATABASE_TEST, padrão vlab_test)
 * exista no mesmo servidor PostgreSQL do ambiente de desenvolvimento.
 * Idempotente: não faz nada se o banco já existir.
 */

$nome = getenv('DB_DATABASE_TEST') ?: 'vlab_test';

if (! preg_match('/^[A-Za-z0-9_]+$/', $nome)) {
    fwrite(STDERR, "Nome de banco de testes inválido: {$nome}".PHP_EOL);
    exit(1);
}

$pdo = new PDO(
    sprintf('pgsql:host=%s;port=%s;dbname=%s', getenv('DB_HOST'), getenv('DB_PORT'), getenv('DB_DATABASE')),
    getenv('DB_USERNAME'),
    getenv('DB_PASSWORD'),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
);

$consulta = $pdo->prepare('SELECT 1 FROM pg_database WHERE datname = ?');
$consulta->execute([$nome]);

if ($consulta->fetchColumn() === false) {
    $pdo->exec("CREATE DATABASE \"{$nome}\"");
    echo "Banco de testes {$nome} criado.".PHP_EOL;
}
