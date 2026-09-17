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
