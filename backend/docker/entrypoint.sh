#!/bin/sh
set -e

mkdir -p bootstrap/cache storage/framework/cache storage/framework/sessions storage/framework/views storage/logs

echo "Aguardando banco de dados..."
until php -r "
try {
    new PDO(
        'pgsql:host=' . getenv('DB_HOST') . ';port=' . getenv('DB_PORT') . ';dbname=' . getenv('DB_DATABASE'),
        getenv('DB_USERNAME'),
        getenv('DB_PASSWORD')
    );
    exit(0);
} catch (Exception \$e) {
    exit(1);
}
" 2>/dev/null; do
    echo "  banco não disponível ainda, aguardando 2s..."
    sleep 2
done

if [ ! -f .env ]; then
    echo "Criando .env a partir de .env.example..."
    cp .env.example .env
fi

if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
    echo "Gerando APP_KEY (fica salva apenas em backend/.env, fora do controle de versão)..."
    php artisan key:generate --force
fi

echo "Banco disponível. Executando migrations..."
php artisan migrate --force

if [ "${APP_SEED:-false}" = "true" ]; then
    echo "Executando seeders..."
    php artisan db:seed --force
fi

if [ "${APP_DEMO_500:-false}" = "true" ]; then
    echo "Conferindo carga fictícia de 500 solicitações..."
    php artisan solicitacoes:popular-demonstracao
fi

php artisan config:clear

echo "Application ready — http://0.0.0.0:8000"
cd public
exec php -S 0.0.0.0:8000 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
