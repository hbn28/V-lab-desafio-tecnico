# ADR 001 — Ordem da fila operacional

## Decisão

A API ordena solicitações abertas antes das encerradas; dentro de cada grupo, por prioridade `URGENTE`, `ALTA`, `MEDIA`, `BAIXA`; em empate, pela criação mais antiga e pelo `id` ascendente.

## Motivo

A página principal representa uma fila de trabalho. Prioridade e tempo de espera ajudam a decidir o próximo atendimento sem exigir ordenação manual e permanecem determinísticos com paginação.

## Limites

Prioridade é um dado administrativo da solicitação, não uma avaliação clínica. O sistema não inventa prioridade nem altera o status automaticamente. O frontend comunica a regra, mas a API permanece como fonte de verdade.

## Verificação

O comportamento é coberto por teste de feature que mistura prioridades, estado encerrado e registros criados em sequência.
