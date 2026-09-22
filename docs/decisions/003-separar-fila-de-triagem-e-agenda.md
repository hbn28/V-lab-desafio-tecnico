# ADR 003 — Ordenação e visibilidade de `agendado_para` na fila

## Contexto

A ADR 001 define a ordenação da "fila operacional": abertas antes de encerradas,
depois por prioridade (`URGENTE` > `ALTA` > `MEDIA` > `BAIXA`) e, em empate, pela
criação mais antiga. Isso decide, sem ordenação manual, qual solicitação atender
a seguir.

Depois da ADR 002, o sistema ganhou `agendado_para` (data/hora) para solicitações
`AGENDADA`, com uma aba "Agenda" dedicada (filtro `data_agendada`, ordenada por
horário e, em empate, prioridade — `SolicitacaoController::index`).

O relato que motiva esta ADR: mesmo com `agendado_para` diferentes, solicitações
`AGENDADA` continuam aparecendo juntas na "Fila atual", como se estivessem
disputando o mesmo atendimento imediato.

## Diagnóstico

1. **A "Fila atual" mistura duas perguntas diferentes.** `RECEBIDA` e
   `EM_ANALISE` ainda não têm data — a fila decide por elas (é exatamente o que
   a ADR 001 resolve). `AGENDADA` já tem hora marcada — a decisão de "quando"
   já foi tomada, mas o registro continuava competindo pela mesma ordenação de
   prioridade/tempo de espera, porque a query tratava as três como um único
   grupo "aberto".
2. **A tabela da fila escondia a data marcada.** Fora da aba "Agenda", a coluna
   final sempre mostrava "Registrada em" (`data_criacao`) — inclusive para
   linhas `AGENDADA`, que já têm um `agendado_para` real. Quem olhava a fila não
   via a informação que explicaria por que aquele item não é urgente agora.
3. **Consequência prática:** duas solicitações `AGENDADA` — uma para amanhã,
   outra para daqui a duas semanas — apareciam lado a lado na fila, ordenadas só
   pela prioridade administrativa.
4. **A causa não é a fórmula da ADR 001.** Ela continua correta para
   `RECEBIDA`/`EM_ANALISE`. O problema é conceitual: fila de triagem (o que
   decidir agora) e agenda de compromissos (o que já foi decidido, com hora
   marcada) são duas visões diferentes, hoje fundidas numa lista só.

## Opções avaliadas

| Melhoria | Custo | Ganho de clareza | Ganho de eficiência | Risco |
|---|---|---|---|---|
| **A. Exibir `agendado_para` também fora da aba Agenda** — coluna mostrando a data marcada em qualquer linha `AGENDADA` | Baixo | Alto | Médio | Baixo |
| B. Tirar `AGENDADA` da "Fila atual" por padrão | Baixo-médio | Alto | Alto | Baixo, mas remove informação hoje visível por padrão — o usuário preferiu manter tudo visível e adicionar filtro em vez de esconder |
| **C. Ordenar por `agendado_para` (em vez de prioridade) quando o filtro de status resolvido for `AGENDADA`** | Baixo | Médio | Alto | Baixo |
| **D. Liberar o filtro `data_agendada` também dentro da "Fila atual"** (não só forçado pela aba Agenda) | Baixo — o backend já validava a combinação de forma genérica; fronteira estava só na UI | Alto | Alto | Baixo |
| E. Fila "inteligente" única que pondera prioridade e proximidade da data num só score | Alto | Baixo (regra deixa de ser explicável) | Incerto | Alto — contraria a proporcionalidade já adotada no projeto (AGENTS.md) e não foi pedida pelo desafio |

## Decisão

**A + C + D**, na versão aditiva combinada com o usuário: em vez de remover
`AGENDADA` da fila (opção B), a fila continua mostrando tudo por padrão, e
ganha:

- **Exibição:** qualquer linha com `agendado_para` mostra a data/hora marcada
  na coluna de data, dentro ou fora da aba Agenda (antes: só na Agenda).
- **Ordenação condicional:** quando o filtro de status resolvido é exatamente
  `AGENDADA` (via filtro explícito ou `data_agendada`), a fila ordena por
  `agendado_para` e, em empate, por prioridade — a mesma regra já usada na
  Agenda — em vez da ordenação por prioridade/tempo de espera da ADR 001, que
  deixa de fazer sentido para quem já tem hora marcada.
- **Filtro de dia na própria fila:** o campo de data (antes exclusivo da aba
  Agenda) passa a aparecer também na "Fila atual" quando o filtro de status é
  `AGENDADA`, reaproveitando o mesmo parâmetro `data_agendada` que a Agenda já
  usa — sem endpoint novo.

Quem não filtra nada continua vendo a fila mesclada, na mesma ordem de sempre —
mas agora com a data visível nas linhas `AGENDADA`, o que já explica por que
aquele item não compete por urgência.

## Fora de escopo (por quê)

- **Recalcular prioridade pela proximidade da data (fila "inteligente", opção
  E).** Substitui uma regra simples e auditável por um score difícil de
  explicar a um atendente; desproporcional e fora do que o desafio pede.
- **Indicador de atraso/no-show para agendamentos vencidos.** Problema
  diferente (acompanhamento pós-agendamento); fica registrado como evolução
  futura.
- **WebSocket/tempo real para a fila.** Já descartado na ADR 002 pelos mesmos
  motivos de proporcionalidade; nada aqui muda essa avaliação.

## Impacto nos requisitos do desafio

- Não altera o modelo de dados, os valores de `status`/`prioridade`, nem o
  fluxo de transição `RECEBIDA → EM_ANALISE → AGENDADA → CONCLUIDA/CANCELADA`
  definidos no documento oficial.
- Não altera o contrato mínimo da API REST sugerido
  (`POST/GET/GET {id}/PATCH status`); o ajuste é apenas ordenação condicional e
  reaproveitamento do filtro `data_agendada` já existente em
  `GET /api/v1/solicitacoes`.
- Fila e Agenda continuam sendo funcionalidades além do mínimo exigido pelo
  desafio (diferenciais de UX/arquitetura, ADRs 001 e 002); ajustá-las não
  compromete nenhum requisito eliminatório nem os critérios de avaliação por
  camada.

## Implementação

- `SolicitacaoController::index` — novo ramo `elseif ($status === 'AGENDADA')`
  ordenando por `agendado_para`, prioridade e protocolo; `$status` passou a ser
  resolvido antes da montagem da query para permitir essa checagem.
- `SolicitacoesPage.tsx` — coluna de data agora mostra `agendado_para` sempre
  que presente (não só na aba Agenda); campo de data adicional na "Fila atual"
  quando `status === 'AGENDADA'`; texto de ordenação da fila reflete a nova
  regra nesse caso; `dataFilaAgendada` é limpo ao trocar de status ou de visão.

## Verificação

- Backend: novo teste de feature (`ListarSolicitacoesTest.php`) cobrindo fila
  filtrada por `status=AGENDADA` ordenada por `agendado_para`, com empate
  desfeito por prioridade — ADR 001 continua coberta pelo teste original, que
  não foi alterado.
- Frontend: suíte completa (Vitest) — 40/40 — mais `tsc --noEmit`, `eslint` e
  `vite build`, todos sem erros.
