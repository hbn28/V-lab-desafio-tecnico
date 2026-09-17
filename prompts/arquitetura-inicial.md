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
8. esqueleto de `docs/openapi.yaml` para os quatro endpoints.

Não implemente autenticação nesta rodada. Não use PHP-FPM sem Nginx. Não gere protocolo em evento do Model; siga o upsert + lock da spec.

Ao terminar, execute as verificações possíveis, atualize `TASKS.md` e `HANDOFF.md` e faça commit se o diretório for um repositório Git.
