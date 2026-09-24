FROM php:8.3-cli-alpine

RUN apk add --no-cache \
    postgresql-dev \
    oniguruma-dev \
    libzip-dev \
    unzip \
    curl \
    && docker-php-ext-install pdo pdo_pgsql mbstring zip bcmath

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json composer.lock* ./
# Imagem de desenvolvimento/avaliação: inclui as dependências de dev (Pest, Pint)
# para que `docker compose exec backend ./vendor/bin/pest` funcione como no README.
RUN composer config --global --no-interaction allow-plugins.pestphp/pest-plugin true \
    && composer config --global --no-interaction policy.advisories.block false \
    && composer install --no-scripts --no-interaction --prefer-dist

COPY . .
RUN composer dump-autoload --optimize

EXPOSE 8000

ENTRYPOINT ["sh", "/app/docker/entrypoint.sh"]
