#!/bin/sh
set -e

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

echo "Banco disponível. Executando migrations..."
php artisan migrate --force

if [ "${APP_SEED:-false}" = "true" ]; then
    echo "Executando seeders..."
    php artisan db:seed --force
fi

echo "Application ready — http://0.0.0.0:8000"
exec php artisan serve --host=0.0.0.0 --port=8000
