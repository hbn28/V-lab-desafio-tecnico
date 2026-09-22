# Nove bônus do desafio — desenho de implementação

**Data:** 2026-09-22

**Fonte de autoridade:** edital oficial, seção 2.5 (página 6 das imagens em `tmp/pdfs/desafio/`), mais as condições eliminatórias e de transparência das páginas 7–8.
**Estado:** especificação para revisão; nenhum dos itens pendentes abaixo está implementado por este documento.

## 1. Objetivo e critério de sucesso

Entregar evidência funcional para os nove itens bônus pedidos no edital, preservando o fluxo principal Laravel 11 + React 18 + PostgreSQL 16. A seção 2.5 permite até 20 pontos extras e exige pertinência e implementação; a simples presença de uma biblioteca não comprova o bônus. O piso eliminatório de backend e frontend continua prioritário.

Cada item termina com uma demonstração reproduzível, teste ou inspeção documentada. `TASKS.md`, `HANDOFF.md`, `README.md`, `docs/spec.md`, `docs/openapi.yaml` e `docs/architecture.md` serão reconciliados durante a execução; marcação como concluído só depois de evidência.

## 2. Estado encontrado em 2026-09-22

| Bônus | Estado atual | Trabalho que falta para comprovar |
|---|---|---|
| Autenticação/autorização | Rotas de negócio públicas; não há modelo `User` nem Policy no código de aplicação | Login por sessão, perfis, autorização por Policy, UI e testes 401/403 |
| Health check | `GET /api/v1/health` consulta PostgreSQL em `HealthController` | Testar 200/503 e ligar o healthcheck do serviço backend no Compose |
| Migrations automáticas | `backend/docker/entrypoint.sh` aguarda o banco e executa `migrate --force` | Demonstrar subida sobre banco isolado vazio e segunda subida idempotente |
| Logs estruturados | `RequestId` e formatação JSON já existem | Cobrir propagação, falhas, ausência de dados pessoais e correlação com worker |
| CI | Não existe `.github/workflows/ci.yml` | Cinco jobs pedidos, PostgreSQL no teste backend e dependências reproduzíveis |
| Documentação arquitetural | `docs/architecture.md` tem diagramas, decisões e evolução | Atualizar com autenticação, sessão/CSRF, worker, notificações e limites reais |
| Acessibilidade | Há labels, semântica e alguns testes de interface | Auditoria com teclado, foco, contraste, estados e larguras 320/768/desktop; corrigir achados |
| Dados fictícios | `SolicitacoesSeeder` fornece 10 registros e é idempotente; factory usa pt_BR | Verificar coerência com Paciente/Agendamento/Fila e acrescentar usuários de demo via configuração local |
| Eventos/filas assíncronas | Não há worker nem fluxo de notificação | Evento pós-commit, listener enfileirado, notificações internas, retries e observabilidade |

O grafo existente em `graphify-out/graph.json` liga `SolicitacaoController` a `CriarSolicitacao` e `AtualizarStatusSolicitacao`, e identifica `HealthController`, `RequestId`, `DatabaseSeeder`, `SolicitacoesSeeder` e `SolicitacaoFactory` nos caminhos acima. Ele serve como mapa; os contratos abaixo foram conferidos também nos arquivos atuais, porque o grafo pode estar defasado.

## 3. Entregas e sequência

### Entrega A — base verificável

Fechar healthcheck no Compose, testes de migrations/seed/logs, auditoria de acessibilidade, documentação e CI. A suíte local já passou em rodada anterior; o CI só será adicionado depois de uma nova execução relevante no checkout de implementação. Corrigir problemas encontrados antes de marcar esses bônus. Essa entrega não muda regras de status, agendamento, falta ou fila.

### Entrega B — autenticação

Adicionar autenticação de primeira parte para a SPA, dois perfis e autorização no servidor. É uma mudança transversal: todas as rotas de negócio, os testes de API, o cliente HTTP, a tela de entrada e as instruções de avaliação precisam mudar juntos. Saúde continua pública.

### Entrega C — evento e fila

Emitir evento quando `AtualizarStatusSolicitacao` confirmar uma transição. Um listener assíncrono cria notificações operacionais para usuários ativos; a SPA exibe notificações próprias. O worker usa a tabela `jobs` no PostgreSQL já obrigatório, sem infraestrutura adicional.

As entregas devem ser integráveis separadamente e validadas nessa ordem. A entrega C depende de usuários autenticados da entrega B.

## 4. Contrato da autenticação

### 4.1 Mecanismo e sessão

Usar Laravel Sanctum em modo SPA de primeira parte com sessão por cookie. O navegador em `http://localhost:5173` acessa a API via proxy Vite; configurar os domínios stateful, `withCredentials`/`credentials: include`, CORS restrito à origem configurada e `supports_credentials=true`. O cliente solicita `/sanctum/csrf-cookie` antes do login e envia o token XSRF nas mutações. A API retorna sempre JSON no formato de erro existente `{ message, errors }`, inclusive 401, 403 e 419. No login, regenerar a sessão; no logout, invalidá-la e regenerar o token CSRF. Não guardar senha nem token no `localStorage`.

Configurar explicitamente sessão e domínio para o ambiente Compose. A rota `/api/v1/health` e o início de sessão ficam públicos; `GET /api/v1/auth/me`, logout, solicitações, fila, faltas, agendamentos e notificações exigem `auth:sanctum`. Aplicar limite de tentativas ao login.

### 4.2 Usuários, perfis e permissões

Migration de `users` com nome, e-mail único, senha com hash, `role` restrito a `ADMINISTRADOR` ou `ATENDENTE`, e estado ativo. Um usuário inativo não consegue iniciar nem manter uma sessão operacional: um middleware confere o estado ativo em cada requisição protegida. Policy de `Solicitacao` é a fonte de autorização para rotas de solicitação e operações de agendamento/falta relacionadas.

| Ação | Administrador | Atendente |
|---|---:|---:|
| Ler painel, solicitações, fila, agenda e faltas | Sim | Sim |
| Criar/editar solicitação, mudar status e operar agenda/faltas | Sim | Sim |
| Apagar solicitação | Sim | Não |
| Ler e marcar notificações próprias | Sim | Sim |

O backend exige a Policy mesmo se o frontend ocultar um controle. A interface mostra a função do usuário, oferece sair e oculta a ação de apagar para `ATENDENTE`. Um 401 leva à tela de entrada sem perder feedback de erro; um 403 mostra recusa compreensível. Não há cadastro público, recuperação de senha nem administração de usuários nesta entrega.

### 4.3 API e avaliação

Adicionar `POST /api/v1/auth/login` (`email`, `password`), `GET /api/v1/auth/me` e `POST /api/v1/auth/logout`. Login e `me` devolvem apenas `id`, `name`, `email`, `role`; nunca senha/hash. Falha de credenciais retorna mensagem genérica, sem indicar se o e-mail existe. Atualizar OpenAPI com autenticação por cookie, CSRF e respostas 401/403/419. Os testes de feature criam usuários fictícios e exercitam cada perfil, sessão, CSRF e proibição no servidor.

Para avaliação local, um seeder idempotente pode criar um administrador e um atendente fictícios **somente** em `local`/`testing`, quando credenciais forem fornecidas por variáveis de ambiente. `.env.example` contém nomes e placeholders vazios; README explica como configurar credenciais locais antes de iniciar. Não versionar senha real nem embutir credencial no Compose. O seeder não sobrescreve senhas existentes em reinícios.

## 5. Saúde, migrations, dados e logs

- **Saúde:** conservar a resposta atual `{ status, db }` do endpoint, com 200 quando `SELECT 1` passa e 503 quando falha. O `healthcheck` do serviço `backend` chama a rota local; a rota não depende de autenticação. O teste saudável usa PostgreSQL; o teste de 503 induz uma exceção controlada de banco e confere que a resposta não expõe credenciais.
- **Migrations:** manter `migrate --force` no entrypoint depois da espera pelo PostgreSQL. Em ambiente vazio, o container cria o schema antes de servir requisições; no reinício, não recria nem perde dados. Migrations novas de `users`, fila e notificações seguem esse mesmo mecanismo. A verificação em ambiente limpo usa banco/volume isolado para não remover dados locais existentes.
- **Dados fictícios:** conservar o conjunto de dez solicitações, cobrindo estados e prioridades, com semântica coerente com as tabelas atuais; revisar os registros `AGENDADA` para que tenham `Agendamento` ativo correspondente, e os `EM_ANALISE` para que tenham entrada de fila se essa for a regra vigente. Valores são claramente de demonstração e não provêm de pacientes reais. `db:seed` roda apenas com `APP_SEED=true` e duas execuções não duplicam protocolos, pacientes, agendamentos ou usuários.
- **Logs:** conservar `X-Request-ID` válido recebido ou gerar UUID, propagando ao cabeçalho e ao contexto JSON. Registrar `api_request` com método, caminho, status e duração. Falhas de autenticação e do worker acrescentam tipo de evento, ID de correlação e resultado; não registram CPF, nome de paciente, telefone, descrição clínica, senha, cookie, token, request body ou stack trace em resposta pública. Uma exceção interna continua visível no log para diagnóstico, com resposta externa genérica e `X-Request-ID`.

## 6. CI, documentação e acessibilidade

### 6.1 CI

Criar `.github/workflows/ci.yml` em push e pull request, com jobs `lint-backend`, `lint-frontend`, `test-backend`, `test-frontend` e `build-frontend`. PHP 8.3/Composer e Node 20/npm usam versões declaradas; `test-backend` sobe serviço PostgreSQL 16 e usa banco exclusivo do job. Executar migrations de teste e Pest nesse banco. Pint, ESLint, Vitest, `tsc` e Vite build rodam nos jobs apropriados. Falhas fazem o workflow falhar; não usar `continue-on-error`.

Validar e versionar deliberadamente o `backend/composer.lock` para que `composer install` seja reproduzível; o arquivo está não rastreado neste checkout e deve ser inspecionado antes de qualquer inclusão. Usar `npm ci` com o lockfile existente. Cada job usa `actions/cache` para `vendor/` ou `node_modules/` conforme sua linguagem, com chaves derivadas dos lockfiles e do ambiente, sem compartilhar artefatos incompatíveis. Jobs de lint/build não precisam de banco. Segredos de teste são valores efêmeros do próprio workflow, não credenciais de produção.

### 6.2 Documentação

Atualizar `docs/architecture.md` com diagrama frontend → API → PostgreSQL e ramo evento → `jobs` → worker → notificações. Documentar fronteiras, decisões de sessão/CSRF, perfis/Policy, idempotência do listener, falhas e operação da fila, além da evolução futura sem prometer integrações externas. Atualizar README com inicialização, credenciais locais fornecidas pelo avaliador, migrations/seed, comandos de teste, CI, health, limitações e uso de IA; `docs/spec.md` e OpenAPI espelham o contrato real. Corrigir documentação antiga que ainda descreva dados legados ou estados já substituídos.

### 6.3 Acessibilidade

Auditar as páginas existentes e as novas telas de entrada/notificações. Critérios mínimos: fluxo completo por teclado, foco sempre visível, ordem de foco lógica, retorno de foco ao fechar diálogo, associação entre labels/ajuda/erros e campos, mensagens de carregamento/erro/sucesso anunciadas, nomes acessíveis para controles, contraste suficiente e nenhum conteúdo perdido em 320 px, 768 px ou desktop. Corrigir o diálogo de drill-down se a auditoria mostrar escape de foco ou falta de retorno ao disparador. Testes de interface cobrem os caminhos de teclado e semântica mais propensos a regressão; uma auditoria automatizada de acessibilidade complementa, mas não substitui, a revisão manual. Registrar no README o roteiro e quaisquer limitações remanescentes.

## 7. Eventos e fila assíncrona

### 7.1 Fluxo

`AtualizarStatusSolicitacao` permanece a única fonte de verdade das transições e mantém sua transação com `lockForUpdate`. Depois de uma transição efetiva, a Action emite `SolicitacaoStatusAtualizado` com `event_id` UUID, `request_id` opcional, ID/protocolo da solicitação e status anterior/novo. O evento implementa `ShouldDispatchAfterCommit`, para que rollback descarte a emissão. Nenhum evento é emitido por transição inválida ou atualização que não alterou o status.

Um listener `CriarNotificacoesOperacionais` implementa `ShouldQueue`, usa a conexão `database` e cria uma notificação para cada usuário ativo. O payload contém apenas protocolo, status e referência interna da solicitação. A tabela `notificacoes_operacionais` tem `event_id`, `user_id`, `solicitacao_id`, `protocolo`, `status_anterior`, `status_novo`, `read_at` e timestamps, com chave única `(event_id, user_id)`. Inserção idempotente impede duplicação em retry. Uma notificação aponta para o detalhe; não envia e-mail, SMS ou dados clínicos a terceiros.

O worker roda como serviço próprio no Compose, usando a mesma imagem do backend e a mesma configuração do banco, com `queue:work database --tries=3 --backoff=5 --timeout=30`. `retry_after` deve superar `timeout`. Migrations criam `jobs` e `failed_jobs` se ausentes. Falha do worker não reverte uma transição já confirmada; um job inserido fica pendente ou entra em `failed_jobs`, com logs por `event_id`/`request_id` e recuperação via `queue:retry`. Existe uma pequena janela entre commit da transição e persistência do job em que uma indisponibilidade de banco pode perder a notificação; essa limitação deve ser documentada, pois outbox não integra este escopo. A documentação registra a consistência eventual.

### 7.2 API e interface

`GET /api/v1/notificacoes` devolve as notificações recentes do usuário autenticado e contagem de não lidas. `PATCH /api/v1/notificacoes/{id}/lida` marca somente uma notificação própria. A SPA mostra um controle “Notificações” com quantidade não lida, lista legível por teclado e link ao detalhe. A consulta possui carregando, vazio, sucesso e erro; o frontend nunca pode consultar ou marcar notificações de outro usuário.

Testes de backend verificam: evento só após commit, rollback sem job, uma notificação por usuário ativo, nenhuma para usuário inativo, retry sem duplicação, falha registrada e isolamento por usuário. Um teste de integração com PostgreSQL e conexão `database` processa um job real; testes unitários podem usar fakes para os limites. Testes de frontend mockam o cliente HTTP e cobrem estados, teclado e a ação de marcar lida.

## 8. Aceite por item e limites

| Item | Evidência de aceite |
|---|---|
| Autenticação | Sem sessão: 401; atendente em delete: 403; administrador autorizado; login/logout/CSRF e UI funcionando |
| Health check | 200 com banco; 503 sem banco; Compose acusa backend não saudável |
| Migrations automáticas | Subida em banco isolado vazio cria schema; segunda subida é segura |
| Logs estruturados | JSON com `request_id`; header correlacionado; falhas registradas sem dados pessoais |
| CI | Cinco jobs verdes em execução real do GitHub Actions, com PostgreSQL 16 no teste backend |
| Documentação arquitetural | Diagramas, decisões, limites e instruções de operação refletem o código entregue |
| Acessibilidade | Roteiro manual de teclado/responsividade e testes de regressão passam; limitações registradas |
| Dados fictícios | Seeder local cria cenário coerente e idempotente, sem dado real nem credencial versionada |
| Eventos/filas | Transição gera job pós-commit; worker cria notificação; rollback/retry/falha demonstrados |

Antes de encerrar, repetir Pint, Pest, Vitest, TypeScript, ESLint e build; validar OpenAPI; testar o fluxo integrado em banco isolado. O item de CI só será chamado “concluído” depois de uma execução remota observada, não apenas por existir um YAML.

Fora do escopo deste bônus: cadastro público, recuperação de senha, autenticação de terceiros, e-mail/SMS, WebSocket, outbox transacional, Redis/SQS, nova máquina de estados ou separação em microsserviços. Se a avaliação não permitir um usuário local configurado, o README deve explicar o pré-requisito de entrada com passos curtos e verificáveis.

## 9. Referências técnicas usadas no desenho

- [Laravel 11 Sanctum — SPA Authentication](https://laravel.com/framework/docs/11.x/sanctum#spa-authentication): sessão por cookie, CSRF e rotas `auth:sanctum`.
- [Laravel 11 Events](https://laravel.com/framework/docs/11.x/events#dispatching-events-after-database-transactions): evento após commit e listener enfileirado.
- [Laravel 11 Queues](https://laravel.com/framework/docs/11.x/queues#jobs-and-database-transactions): driver database, retries, `failed_jobs` e relação timeout/`retry_after`.
