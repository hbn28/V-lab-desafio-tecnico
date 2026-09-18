# Fila de tarefas

Estado reconciliado em 2026-09-18. O CI permanece deliberadamente fora desta rodada.

- [x] Arquitetura inicial: stack, pastas, migrations, Docker Compose, tipos e OpenAPI base
- [x] Backend: criar solicitação, protocolo concorrente e validações
- [x] Backend: listar com filtros/paginação e consultar detalhe
- [x] Backend: atualizar status com transação, lock e erros padronizados
- [x] Frontend: estrutura visual, resumo inicial, listagem, filtros e paginação
- [x] Frontend: formulário de criação com validação e erros acessíveis
- [x] Frontend: detalhe e atualização de status
- [x] Integração real frontend → Laravel → PostgreSQL e quatro estados assíncronos
- [ ] Testes backend em PostgreSQL: ampliar concorrência, constraints e filtros inválidos — bloqueado até Docker/PostgreSQL disponível
- [x] Teste frontend relevante com cliente HTTP mockado
- [x] Correção: adicionar `eslint.config.mjs` compatível com ESLint 9 e validar `npm run lint`
- [x] Segurança e configuração: erros centrais, CORS, `.env.example`, APP_KEY e dados fictícios
- [x] Completar `docs/openapi.yaml` com os endpoints implementados e códigos principais
- [x] README, `docs/architecture.md`, mapa do código e manual de agentes
- [ ] Revisão eliminatória em ambiente limpo com Docker Compose — bloqueada porque o daemon Docker não está disponível
- [x] Fila operacional: estados ativos, prioridade descendente, mais antigas primeiro, com teste de feature e documentação
- [x] Dashboard operacional: separar prioridades abertas do andamento, destacar urgente/alta e eliminar ambiguidade visual entre prioridade e status

## Bônus

- [x] Seeders/factories fictícios e idempotentes
- [x] Health check da API e verificação PostgreSQL
- [x] Middleware `RequestId` e logs estruturados JSON
- [ ] CI com lint, testes e build — fora do escopo autorizado nesta rodada
- [x] `docs/architecture.md` com decisões e visão de evolução
- [ ] Autenticação/autorização simples — opcional, adiada até o contrato base estar consolidado
