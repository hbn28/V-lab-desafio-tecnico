#!/bin/sh
set -e

echo "Aguardando banco de dados..."
until php artisan db:monitor --databases=pgsql 2>/dev/null; do
  sleep 1
done

echo "Executando migrations..."
php artisan migrate --force

if [ "${APP_SEED:-false}" = "true" ]; then
  echo "Executando seeders..."
  php artisan db:seed --force
fi

echo "Iniciando servidor..."
exec php artisan serve --host=0.0.0.0 --port=8000
