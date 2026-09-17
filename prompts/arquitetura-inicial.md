# Rodada: arquitetura inicial

Leia `AGENTS.md`, `HANDOFF.md`, `docs/spec.md` e `TASKS.md`, nessa ordem. O edital é a autoridade final e a spec é o contrato interno.

Crie somente o esqueleto necessário:

1. `backend/` com Laravel 11 e domínio `app/Domain/Solicitacoes/`;
2. `frontend/` com React 18, TypeScript, Vite e React Router;
3. migrations de `solicitacoes` e `protocolo_counters`, com os CHECKs da spec;
4. estrutura de Actions, Form Requests, Controller e Resource, sem DTO ou Repository;
5. tipos TypeScript, cliente HTTP, rotas e tokens semânticos mínimos; sem telas completas;
6. Docker Compose com `frontend`, backend HTTP e PostgreSQL saudável;
7. `.env.example`, `.gitignore` e `.dockerignore` sem segredos;
8. esqueleto de `docs/openapi.yaml` para os quatro endpoints + `GET /api/v1/health`;
9. `app/Http/Middleware/RequestId.php` registrado no grupo `api` em `bootstrap/app.php` (bônus de baixo custo, melhor instalar agora);
10. `app/Domain/Health/HealthController.php` com rota `GET /api/v1/health` (bônus de baixo custo, melhor instalar agora);
11. `docker/backend/entrypoint.sh` com `migrate --force` e seed condicional por `APP_SEED`.

Não implemente autenticação nesta rodada. Não use PHP-FPM sem Nginx. Não gere protocolo em evento do Model; siga o upsert + lock da spec.

### Estrutura de pastas esperada ao final desta rodada

```
backend/
  app/
    Domain/
      Health/
        HealthController.php
      Solicitacoes/
        Actions/
          CriarSolicitacao.php         (esqueleto)
          AtualizarStatusSolicitacao.php (esqueleto)
        Http/
          Controllers/
            SolicitacaoController.php  (esqueleto)
          Requests/
            CriarSolicitacaoRequest.php (esqueleto)
            AtualizarStatusRequest.php  (esqueleto)
            ListarSolicitacoesRequest.php (esqueleto)
          Resources/
            SolicitacaoResource.php    (esqueleto)
    Http/
      Middleware/
        RequestId.php
  bootstrap/
    app.php                            (registra middleware + exceções)
  database/
    migrations/
      xxxx_create_protocolo_counters_table.php
      xxxx_create_solicitacoes_table.php
    seeders/
      DatabaseSeeder.php
      SolicitacoesSeeder.php           (esqueleto idempotente)
    factories/
      SolicitacaoFactory.php           (esqueleto com Faker pt_BR)
  routes/
    api.php                            (quatro endpoints + health)
  docker/
    backend/
      entrypoint.sh
frontend/
  src/
    features/
      solicitacoes/
        api/
          client.ts                    (cliente HTTP tipado, esqueleto)
        types/
          index.ts                     (tipos do domínio)
        components/                    (vazio, criado na rodada de UI)
        hooks/                         (vazio)
    App.tsx
    main.tsx
  vite.config.ts
  tsconfig.json
docker-compose.yml
docs/
  openapi.yaml                         (esqueleto com os 5 paths)
  spec.md
  plano-tecnico.md
  architecture.md                      (esqueleto, preenchido ao final)
.env.example
.gitignore
.dockerignore
```

### Checklist antes de terminar esta rodada

- [ ] `docker compose up --build` sobe os três serviços sem erro
- [ ] `GET http://localhost:8000/api/v1/health` retorna `{"status":"ok","db":"ok"}`
- [ ] `php artisan migrate` roda sem erro; tabelas existem no PostgreSQL
- [ ] `npm run build` no frontend termina sem erro
- [ ] Nenhum segredo em arquivo versionado

Ao terminar, execute as verificações possíveis, atualize `TASKS.md` e `HANDOFF.md` e faça commit se o diretório for um repositório Git.
