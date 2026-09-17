# TASKS.md

Fila de tarefas em ordem de dependência e valor para o edital.

- [ ] Arquitetura inicial: stack, pastas, migrations, Docker Compose, tipos e OpenAPI base — ver `prompts/arquitetura-inicial.md`
- [ ] Backend: criar solicitação, protocolo concorrente e validações
- [ ] Backend: listar com filtros/paginação e consultar detalhe
- [ ] Backend: atualizar status com transação, lock e erros padronizados
- [ ] Frontend: estrutura visual, resumo inicial, listagem, filtros e paginação
- [ ] Frontend: formulário de criação com validação
- [ ] Frontend: detalhe e atualização de status
- [ ] Integração real frontend → Laravel → PostgreSQL e quatro estados assíncronos
- [ ] Testes backend em PostgreSQL: regras, constraints, concorrência e filtros inválidos
- [ ] Teste frontend relevante com cliente HTTP mockado
- [ ] Segurança e configuração: erros centrais, CORS, `.env.example`, APP_KEY e dados fictícios
- [ ] Completar `docs/openapi.yaml` com os quatro endpoints e códigos principais
- [ ] README e `docs/architecture.md`, incluindo execução, limitações e uso de IA
- [ ] Revisão eliminatória em ambiente limpo com Docker Compose
- [ ] Bônus: seeders/factories fictícios e idempotentes
- [ ] Bônus: health check da API e PostgreSQL
- [ ] Bônus: CI com lint, testes e build usando PostgreSQL
- [ ] Bônus opcional final: autenticação/autorização simples, somente após contrato e testes próprios
