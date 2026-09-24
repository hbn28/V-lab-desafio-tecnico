# Mapa rápido do código

## Fluxo principal

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
- Agenda — dois pontos de mutação: `PATCH /solicitacoes/{id}/status` (agendamento inicial, `AtualizarStatusRequest`) e `PATCH /solicitacoes/{id}/agendamento` (`ReagendarSolicitacao.php` + `ReagendarSolicitacaoRequest.php`, só altera `agendado_para`).
- Fuso e conversão data/hora local ⇄ UTC: `Support/HorarioAgendamento.php` e `config/agendamento.php` (front: `features/solicitacoes/config/agendamento.ts`).
- Filtro diário `data_agendada`: validado em `ListarSolicitacoesRequest.php`, consultado em `Actions/ListarSolicitacoes.php` — OR entre `agendado_para` no intervalo UTC semiaberto do dia (modalidade HORARIO) e `Agendamento` ativo com `modalidade=TURNO`/`data_agendada` igual ao dia (TURNO nunca preenche `agendado_para`, por isso o segundo ramo é necessário); ordem: horário exato primeiro, depois turno (MANHA/TARDE/NOITE), prioridade, protocolo, id.
- ADR 003 (`docs/decisions/003-separar-fila-de-triagem-e-agenda.md`): `status=AGENDADA` sem `data_agendada` também ordena por `agendado_para` em `Actions/ListarSolicitacoes.php`; a "Fila atual" ganha um filtro de dia opcional e mostra `agendado_para` em qualquer linha que o tenha, não só na aba Agenda.
- Formulário de horário: `frontend/.../components/AgendamentoForm.tsx`, usado por `SolicitacaoDetailPage.tsx` (agendar/reagendar) e visão `agenda` de `SolicitacoesPage.tsx`.
- Ordenação da fila e grupos de status: `Actions/ListarSolicitacoes.php` — decide a ordenação (fila operacional ativa vs. histórico encerrado por `updated_at` descendente) a partir de `status_grupo`.
- Validação de `status_grupo` (`aberto`/`encerrado`): `ListarSolicitacoesRequest.php`.
- Erros de regra (409): Actions lançam `Exceptions/ConflitoDeEstado.php`, traduzida em `bootstrap/app.php`.
- Validação de agenda compartilhada (horário XOR turno, fuso, futuro): `Http/Requests/Concerns/ValidaAgendamento.php`.
- Contrato de saída: `SolicitacaoResource.php` (CPF mascarado em listagens; `SolicitacaoResource::detalhe()` traz o completo) e `frontend/src/features/solicitacoes/types/index.ts`.
- Cliente e envelope de erro: `frontend/src/features/solicitacoes/api/client.ts`.
- Tokens e responsividade: `frontend/src/index.css` e `docs/design-system.md`.
- Testes de comportamento: `backend/tests/Feature/` e `frontend/src/test/solicitacoes.test.tsx`.
- Tela de fila atual, agenda e exploração por categoria: `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx` (alterna `VisaoPrincipal` entre `fila`/`agenda`/`faltas` — a visão `faltas` é o componente `components/FaltasView.tsx` —, refletida na URL `?visao=&data=`, e `ModoFila` entre `prioridade`/`categoria`; trocar de visão reseta os filtros locais e a página).
- Histórico encerrado (CONCLUIDA/CANCELADA) é página própria, não visão de `SolicitacoesPage`: `frontend/src/features/solicitacoes/pages/HistoricoSolicitacoesPage.tsx`, rota `/solicitacoes/historico`, link na navegação (`components/Layout.tsx`). Separada para não diluir o destaque operacional da fila (ADR: quanto mais separado o que está em aberto do que já foi encerrado, mais fácil de visualizar).
- Componentes compartilhados entre `SolicitacoesPage` e `HistoricoSolicitacoesPage`: `components/ViewSwitcher.tsx` (navegação fila/agenda/histórico/faltas) e `components/SolicitacoesTable.tsx` (tabela + paginação + estados de carregando/erro/vazio).

## Pacientes, fila contínua, agenda por turno e faltas

- Paciente reaproveitado por CPF: `Actions/LocalizarOuCriarPaciente.php` (usado na criação e na edição; editar o CPF revincula o paciente), mascaramento em `Support/MascararContato.php` e `PacienteResumoResource.php`.
- Fila contínua (entradas/saídas independentes da paginação): efeitos em `AtualizarStatusSolicitacao.php` (abre em `EM_ANALISE`, fecha em `AGENDADA`/`CANCELADA`), leitura em `Actions/ListarFilaOperacional.php` / `GET /fila`, `EntradaFilaResource.php`.
- Agendamento por horário ou turno: `Support/TurnoAgendamento.php` (deriva turno / calcula fim do turno em UTC), `AgendamentoResource.php`, `Actions/AtualizarStatusSolicitacao.php` e `Actions/ReagendarSolicitacao.php` (criam/atualizam a linha `Agendamento` ativa). Front: `derivarTurnoDaHora()` em `config/agendamento.ts`, formulário em `components/AgendamentoForm.tsx` (radio Horário exato / Turno).
- Faltas: `Actions/RegistrarFaltaAgendamento.php` (`POST /agendamentos/{id}/falta`), `Actions/RegistrarTentativaContato.php` (`POST /agendamentos/{id}/tentativas-contato`, payload só `resultado`), `Actions/ReagendarAposFalta.php` (`POST /agendamentos/{id}/reagendar-apos-falta`, cria novo `Agendamento` preservando o `FALTA` antigo). `AtualizarStatusSolicitacao::concluirAgendamentoAtivo()` corrige uma falta ao concluir (`falta_corrigida_em`). `solicitacoes.status` nunca vira `FALTA` — o estado vive só em `agendamentos.status`.
- Listagem de faltas pendentes: `Actions/ListarFaltasPendentes.php` (`GET /faltas`; some ao reagendar, cancelar ou concluir).
- Tela de faltas: `components/FaltasView.tsx` (visão `?visao=faltas` de `SolicitacoesPage.tsx`, hook `useFaltas` em `hooks/useSolicitacoes.ts`); registro da falta pelo botão "Registrar falta" em `SolicitacaoDetailPage.tsx`; `components/FaltaCard.tsx`, `components/ContatoFaltaDialog.tsx` (quatro opções fechadas, sem texto livre), `components/GrupoTurnoAgenda.tsx` (agrupamento da agenda por turno).
- Testes novos: `backend/tests/Feature/{PacienteSolicitacaoTest,AgendamentoTurnoTest,FilaOperacionalTest,FaltasTest,ReagendarAposFaltaTest}.php`, `frontend/src/test/{agendamento-turno,faltas}.test.tsx`; `backend/tests/Feature/{RequestIdTest,SeederTest}.php`.

## Alertas de manutenção

- O frontend pode esconder transições impossíveis, mas nunca decide uma transição.
- A fila é paginada; o resumo do painel vem de `GET /solicitacoes/resumo` e pode representar o conjunto global ou os filtros documentados.
- A fila é ordenada no backend para não quebrar paginação.
- `graphify-out` é artefato derivado; o mapa acima é o fallback humano quando a CLI não estiver instalada.
