# TASKS.md

Fila de tarefas em ordem de dependência e valor para o edital.

- [ ] Arquitetura inicial: stack, pastas, migrations, Docker Compose, tipos e OpenAPI base — ver `prompts/arquitetura-inicial.md`
- [ ] Backend: criar solicitação, protocolo concorrente e validações
- [ ] Backend: listar com filtros/paginação e consultar detalhe
- [ ] Backend: atualizar status com transação, lock e erros padronizados
- [x] Frontend: estrutura visual, resumo inicial, listagem, filtros e paginação
- [ ] Frontend: formulário de criação com validação
- [ ] Frontend: detalhe e atualização de status
- [ ] Integração real frontend → Laravel → PostgreSQL e quatro estados assíncronos
- [ ] Testes backend em PostgreSQL: regras, constraints, concorrência e filtros inválidos
- [ ] Teste frontend relevante com cliente HTTP mockado
- [ ] Correção: adicionar `eslint.config.js` compatível com ESLint 9 e validar `npm run lint`
- [ ] Segurança e configuração: erros centrais, CORS, `.env.example`, APP_KEY e dados fictícios
- [ ] Completar `docs/openapi.yaml` com os quatro endpoints + health check e códigos principais
- [ ] README e `docs/architecture.md`, incluindo execução, limitações e uso de IA
- [ ] Revisão eliminatória em ambiente limpo com Docker Compose

## Bônus (implementar nesta ordem, somente após a base sólida)

- [ ] Bônus: seeders/factories fictícios e idempotentes (chama-os `php artisan db:seed` no entrypoint do backend se `APP_SEED=true`)
- [ ] Bônus: health check da API (`GET /api/v1/health`) e verificação PostgreSQL via `DB::select('SELECT 1')`
- [ ] Bônus: middleware `RequestId` que propaga/gera `X-Request-ID` e logs estruturados JSON com `request_id`, `method`, `path`, `status`, `duration_ms`
- [ ] Bônus: CI com lint (Pint + ESLint), testes (Pest + Vitest) e build usando PostgreSQL — ver `.github/workflows/ci.yml`
- [ ] Bônus: `docs/architecture.md` com diagrama Mermaid, decisões e visão de evolução para microsserviços
- [ ] Bônus opcional final: autenticação/autorização simples, somente após contrato e testes próprios
