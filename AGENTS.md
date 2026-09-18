# AGENTS.md

Instruções para qualquer agente (Claude Code, Codex CLI, ou humano) trabalhando neste repositório.

## Antes de qualquer coisa

1. Leia `HANDOFF.md` — diz a última tarefa concluída, a próxima da fila e bloqueios conhecidos.
2. Leia `docs/spec.md` — é o contrato interno de dados e API.
3. Leia `TASKS.md` — pegue a próxima tarefa não marcada, na ordem em que aparece.
4. O edital prevalece sobre documentos internos. Se detectar conflito, registre o bloqueio antes de codificar.
5. Não repita tarefa concluída. Se faltar algo, adicione uma tarefa corretiva explícita.

## Stack obrigatória

PHP 8.3, Laravel 11, Node 20, React 18 + TypeScript, Vite, PostgreSQL 16, Docker e Docker Compose. Não substitua a stack obrigatória.

## Arquitetura — backend

- Organização por domínio em `app/Domain/Solicitacoes/`, não por camada técnica solta.
- Controllers só orquestram: FormRequest → Action → Resource. Nenhuma regra de negócio em Controller.
- A máquina de estados de status vive inteira na Action `AtualizarStatusSolicitacao` — é a única fonte de verdade sobre quais transições são permitidas (RECEBIDA → EM_ANALISE/CANCELADA; EM_ANALISE → AGENDADA/CANCELADA; AGENDADA → CONCLUIDA/CANCELADA; CONCLUIDA e CANCELADA são finais).
- Toda mutação de status roda em `DB::transaction` e lê a linha com `lockForUpdate`.
- `CriarSolicitacao` gera protocolo com upsert da linha anual antes do lock; nunca usar Model event nem `count() + 1`.
- Erros: 422 para entrada inválida e 409 para qualquer transição inválida. Todo erro JSON usa `{ message, errors }`.
- No Laravel 11, traduza exceções em `bootstrap/app.php`; não crie Handler separado sem necessidade.
- Autenticação é bônus e não pertence ao caminho crítico.
- Não adicione camadas (Repository, CQRS, Event Sourcing) sem benefício demonstrável — o edital avalia isso negativamente.

## Arquitetura — frontend

- Organização por domínio em `src/features/solicitacoes/{api,types,components,hooks}`.
- Tipos TypeScript espelham exatamente o contrato da API — nunca use `any`.
- A tela inicial inclui resumo por status ou prioridade, listagem e filtros.
- Antes de codificar telas, use a skill **UI/UX Pro Max**. Mantenha tokens primitivos/semânticos mínimos; não crie tokens por componente sem reutilização real.
- Sempre trate os 4 estados assíncronos: carregando, sucesso, vazio, erro.

## Banco de dados

- Schema só evolui por migrations do Laravel — nunca altere o banco manualmente.
- `categoria`, `prioridade` e `status` usam CHECK constraint. A justificativa URGENTE também tem CHECK condicional.
- Índices em `status`, `categoria` e `prioridade` (são os filtros da listagem).
- Testes de constraints, transações e locks usam PostgreSQL, não SQLite.

## Testes

- Toda regra de negócio nova em uma Action precisa de pelo menos um teste Pest cobrindo o caminho feliz e um caminho de erro.
- Testes de frontend mockam o cliente HTTP — nunca fazem chamada real.
- Testes rodam isolados e determinísticos, sem depender de dados reais ou de ordem de execução.
- Teste concorrente cobre a primeira geração de protocolo de um ano.

## Segurança

- Nunca versionar `.env`, tokens ou credenciais — só `.env.example` com placeholders.
- Nunca usar dado pessoal ou clínico real, nem em seeders/factories.
- CORS restrito à origem do frontend, nunca `*`.
- `APP_KEY` permanece fora da imagem e estável entre reinícios.

## Ao terminar uma tarefa

1. Rode os testes relevantes.
2. Marque a tarefa como concluída em `TASKS.md`.
3. Reescreva `HANDOFF.md` com a última tarefa, a próxima e bloqueios.
4. Se houver repositório Git, faça `git add -A && git commit -m "<resumo da tarefa>"`. Se não houver, registre o bloqueio; não finja que houve commit.

## Bônus — Health Check

- Rota `GET /api/v1/health` em `app/Domain/Health/HealthController.php`.
- Invoca `DB::select('SELECT 1')` dentro de try/catch; retorna 200 ou 503.
- Registrar a rota em `routes/api.php` fora do grupo com rate-limit de avaliação.
- O Docker Compose `healthcheck` do serviço `backend` deve chamar esse endpoint.

## Bônus — Middleware RequestId e Logs Estruturados

- Criar `app/Http/Middleware/RequestId.php`.
- Prioridade: header `X-Request-ID` de entrada (se UUID válido) > `Str::uuid()`.
- Propagar para: `request->attributes`, header de resposta, `Log::withContext`.
- Registrar no grupo `api` em `bootstrap/app.php`.
- Configurar `JsonFormatter` no canal `stack` em `config/logging.php`.
- No método `terminate()`, logar `api_request` com `request_id`, `method`, `path`, `status`, `duration_ms`.
- Nunca logar body completo de request/response — apenas metadados.

## Bônus — Seeders Idempotentes

- `SolicitacoesSeeder` usa `firstOrCreate` pelo campo `protocolo` — nunca duplica.
- `SolicitacaoFactory` usa `Faker` pt_BR; preenche `justificativa_prioridade` quando `URGENTE`.
- Entrypoint executa `php artisan db:seed --force` somente se `APP_SEED=true`.
- Mínimo 10 registros cobrindo todos os status e pelo menos 1 URGENTE com justificativa.

## Bônus — CI

- Arquivo `.github/workflows/ci.yml` com jobs: `lint-backend`, `lint-frontend`, `test-backend`, `test-frontend`, `build-frontend`.
- Job `test-backend` sobe PostgreSQL 16 como serviço e usa variáveis de ambiente `DB_*`.
- Jobs de lint e build não precisam de banco.
- Todos os jobs usam cache de dependências (`actions/cache` para `vendor/` e `node_modules/`).
- CI só é adicionado após as suítes locais passarem consistentemente.

## Bônus — architecture.md

- Criar `docs/architecture.md` ao final, depois do fluxo integrado estar estável.
- Incluir diagrama Mermaid com três camadas (frontend, backend, db) e fluxo de uma requisição.
- Registrar as principais decisões: protocolo com upsert+lock, máquina de estados centralizada, organização por domínio, ausência de Repository/CQRS.
- Adicionar parágrafo de evolução: como o módulo poderia separar-se em serviço independente (ex: fila para notificações, API Gateway, domínio de Agenda).

## Operação dos agentes

- Consulte `docs/agent-playbook.md` e `docs/codebase-map.md` depois dos quatro arquivos obrigatórios.
- Use Graphify se a CLI estiver instalada; se não estiver, use o mapa humano e o relatório existente sem bloquear a tarefa.
- A fila da listagem é ordenada server-side: estados ativos, prioridade descendente, mais antigas primeiro.
- Mudanças de comportamento seguem teste primeiro; não altere CI nesta fila.
