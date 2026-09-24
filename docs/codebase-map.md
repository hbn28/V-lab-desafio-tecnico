# Mapa rápido do código

## Fluxo principal

No Railway, `frontend/Dockerfile` usa a etapa `production` com `frontend/Caddyfile`: o build estático atende na porta 5173 e encaminha `/api/*` e `/sanctum/*` ao backend. O Compose local seleciona a etapa `dev` para manter o Vite. Veja `docs/railway-deployment.md`.

```text
frontend/src/features/solicitacoes/pages
  -> hooks/useSolicitacoes.ts (listagem, resumo e próximo atendimento)
  -> api/client.ts
  -> backend/routes/api.php
  -> SolicitacaoController
  -> FormRequest / Action / Resource
  -> PostgreSQL (Solicitacao + protocolo_counters)
```

## Pontos de extensão

- Regras de criação e protocolo: `backend/app/Domain/Solicitacoes/Actions/CriarSolicitacao.php`.
- Máquina de estados: `AtualizarStatusSolicitacao.php` (única autoridade sobre `status`; também grava `agendado_para` ao entrar em `AGENDADA`).
- Agenda — dois pontos de mutação: `PATCH /solicitacoes/{id}/status` (agendamento inicial, `AtualizarStatusRequest`) e `PATCH /solicitacoes/{id}/agendamento` (`ReagendarSolicitacao.php` + `ReagendarSolicitacaoRequest.php`, atualiza a linha ativa de `Agendamento` e o campo legado `agendado_para` quando há horário exato).
- Fuso e conversão data/hora local ⇄ UTC: `Support/HorarioAgendamento.php` e `config/agendamento.php` (front: `features/solicitacoes/config/agendamento.ts`).
- Busca, filtros por período e ordenação de solicitações: `ListarSolicitacoesRequest.php` valida os parâmetros; `Actions/ListarSolicitacoes.php` aplica-os no servidor. `data_agendada` combina horário no intervalo UTC semiaberto com turno na data local; horário exato vem antes dos turnos (MANHA/TARDE/NOITE), com desempate por prioridade, protocolo e id.
- ADR 003 (`docs/decisions/003-separar-fila-de-triagem-e-agenda.md`): `status=AGENDADA` sem `data_agendada` ordena por data operacional em `ListarSolicitacoes`; a "Fila atual" tem filtro de dia opcional e mostra o horário ou turno da linha ativa. Solicitações cujo agendamento virou `FALTA` deixam de aparecer na agenda.
- Formulário de horário: `frontend/.../components/AgendamentoForm.tsx`, usado por `SolicitacaoDetailPage.tsx` (agendar/reagendar) e visão `agenda` de `SolicitacoesPage.tsx`.
- Listagem e grupos de status: `SolicitacaoController::index()` delega a `Actions/ListarSolicitacoes.php`; fila por padrão prioriza urgência/antiguidade, agenda por horário/turno e histórico por encerramento. Ordenações alternativas são allowlisted e paginadas no servidor.
- Validação de `status_grupo` (`aberto`/`encerrado`): `ListarSolicitacoesRequest.php`.
- Contrato de saída: `SolicitacaoResource.php` e `frontend/src/features/solicitacoes/types/index.ts`.
- Cliente e envelope de erro: `frontend/src/features/solicitacoes/api/client.ts`.
- Tokens e responsividade: `frontend/src/index.css` e `docs/design-system.md`; o cabeçalho reflui até 62rem, a tabela rola dentro do painel e o popup de notificações/toolbar do modal têm regras próprias para espaços estreitos.
- Testes de comportamento: `backend/tests/Feature/` e `frontend/src/test/solicitacoes.test.tsx`.
- Tela de fila, solicitações agendadas, histórico e faltas: `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx`; `SolicitacoesToolbar.tsx` padroniza busca/filtros/ordenação; `useSolicitacoesQuery.ts` mantém o estado na URL; `useAgendaSemanal.ts` mantém paginação individual em sete filas diárias.
- Navegação operacional persistente: `frontend/src/components/Layout.tsx`. Ao abrir detalhe/edição, `location.state.from` preserva a consulta local para o retorno seguro à coleção.

## Pacientes, fila contínua, agenda por turno e faltas

- Paciente reaproveitado por CPF: `CriarSolicitacao::localizarOuCriarPaciente()` e `AtualizarSolicitacao::localizarOuCriarPaciente()` mantêm o vínculo ao editar; mascaramento em `Support/MascararContato.php` e `PacienteResumoResource.php`.
- Fila contínua (entradas/saídas independentes da paginação): efeitos em `AtualizarStatusSolicitacao.php` (abre em `EM_ANALISE`, fecha em `AGENDADA`/`CANCELADA`), leitura em `SolicitacaoController::fila()` / `GET /fila`, `EntradaFilaResource.php`.
- Agendamento por horário ou turno: `Support/TurnoAgendamento.php` (deriva turno / calcula fim do turno em UTC), `AgendamentoResource.php`, `Actions/AtualizarStatusSolicitacao.php` e `Actions/ReagendarSolicitacao.php` (criam/atualizam a linha `Agendamento` ativa). Front: `derivarTurnoDaHora()` em `config/agendamento.ts`, formulário em `components/AgendamentoForm.tsx` (radio Horário exato / Turno).
- Faltas: `Actions/RegistrarFaltaAgendamento.php` (`POST /agendamentos/{id}/falta`), `Actions/RegistrarTentativaContato.php` (`POST /agendamentos/{id}/tentativas-contato`, payload só `resultado`), `Actions/ReagendarAposFalta.php` (`POST /agendamentos/{id}/reagendar-apos-falta`, cria novo `Agendamento` preservando o `FALTA` antigo). `AtualizarStatusSolicitacao::concluirAgendamentoAtivo()` corrige uma falta ao concluir (`falta_corrigida_em`). `solicitacoes.status` nunca vira `FALTA` — o estado vive só em `agendamentos.status`.
- Tela de faltas: `SolicitacaoDetailPage.tsx` oferece `Registrar falta` para agendamento ativo; `SolicitacoesPage.tsx` (visão `?visao=faltas`, hook `useFaltas` em `hooks/useSolicitacoes.ts`) gerencia contato e reagendamento. `components/FaltaCard.tsx`, `components/ContatoFaltaDialog.tsx` (quatro opções fechadas, sem texto livre), `components/GrupoTurnoAgenda.tsx` (agrupamento da agenda por turno) e `components/DialogOverlay.tsx` compõem os fluxos.
- Testes novos: `backend/tests/Feature/{PacienteSolicitacaoTest,AgendamentoTurnoTest,FilaOperacionalTest,FaltasTest,ReagendarAposFaltaTest}.php`, `frontend/src/test/{agendamento-turno,faltas}.test.tsx`.

## Alertas de manutenção

- O frontend pode esconder transições impossíveis, mas nunca decide uma transição.
- A fila é paginada; o resumo do painel vem de `GET /solicitacoes/resumo` e pode representar o conjunto global ou os filtros documentados.
- A fila é ordenada no backend para não quebrar paginação.
- API documentada em `docs/spec.md` e `docs/openapi.yaml` inclui busca, período, ordenação e faltas filtráveis.
- `graphify-out` é artefato derivado. Em 23/09/2026, `graphify . --update --code-only` atualizou `graph.json` (1072 nós/2028 arestas/70 comunidades); o relatório textual não foi regenerado por `--code-only`. Este mapa permanece a leitura humana curta.

## Autenticação, notificações e verificação

- Sessão e autorização: `backend/app/Domain/Auth/`, `backend/app/Policies/`, `backend/routes/api.php`; cliente/telas em `frontend/src/features/auth/`. O login aceita usuário ou e-mail legado; `operadores:criar` gera conta com usuário e e-mail opcional.
- Carga fictícia de 500 solicitações: `backend/app/Domain/Solicitacoes/Console/PopularSolicitacoesDemo.php`, registrada em `backend/bootstrap/app.php`; execução única opcional no entrypoint por `APP_DEMO_500=true`. Não altera a Action de criação nem o protocolo sequencial dos registros operacionais.
- Evento após commit: `SolicitacaoStatusAtualizado`; listener enfileirado `CriarNotificacoesOperacionais`; serviço Docker `worker`; notificações e API em `backend/app/Domain/Notificacoes/`. A API pagina grupos de 20 por operador, e o painel carrega páginas antigas sob demanda.
- Cobertura de fila: `backend/tests/Feature/NotificacaoQueueTest.php` (commit/rollback, worker real, isolamento, idempotência e minimização de dados).
- Cobertura de interface/fluxos: `frontend/src/test/accessibility.test.tsx`, `agenda.test.tsx`, `solicitacoes.test.tsx`, `faltas.test.tsx`, `agendamento-detalhe.test.tsx`, `auth.test.tsx`, `notificacoes.test.tsx` e `use-solicitacoes-race.test.tsx`.
- Revisão visual registrada em `docs/accessibility-review.md`; zoom 200%, contraste calculado e dimensões de alvos de toque ainda não foram medidos. `graphify-out/GRAPH_REPORT.md` antecede as mudanças mais recentes; use este mapa humano e o `graph.json` atualizado como orientação atual.
