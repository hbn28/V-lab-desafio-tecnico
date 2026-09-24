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
# Produção (Railway) instala só as dependências de runtime, como antes. O
# docker-compose local passa INSTALAR_DEPENDENCIAS_DEV=true para incluir Pest e
# Pint, e `docker compose exec backend ./vendor/bin/pest` funcionar como no README.
ARG INSTALAR_DEPENDENCIAS_DEV=false
RUN composer config --global --no-interaction allow-plugins.pestphp/pest-plugin true \
    && composer config --global --no-interaction policy.advisories.block false \
    && if [ "$INSTALAR_DEPENDENCIAS_DEV" = "true" ]; then \
        composer install --no-scripts --no-interaction --prefer-dist; \
    else \
        composer install --no-dev --no-scripts --no-interaction --prefer-dist; \
    fi

COPY . .
RUN mkdir -p bootstrap/cache
RUN composer dump-autoload --optimize

EXPOSE 8000

ENTRYPOINT ["sh", "/app/docker/entrypoint.sh"]
