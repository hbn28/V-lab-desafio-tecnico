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
- Máquina de estados: `AtualizarStatusSolicitacao.php`.
- Ordenação da fila e grupos de status: `SolicitacaoController::index()` — decide a ordenação (fila operacional ativa vs. histórico encerrado por `updated_at` descendente) a partir de `status_grupo`.
- Validação de `status_grupo` (`aberto`/`encerrado`): `ListarSolicitacoesRequest.php`.
- Contrato de saída: `SolicitacaoResource.php` e `frontend/src/features/solicitacoes/types/index.ts`.
- Cliente e envelope de erro: `frontend/src/features/solicitacoes/api/client.ts`.
- Tokens e responsividade: `frontend/src/index.css` e `docs/design-system.md`.
- Testes de comportamento: `backend/tests/Feature/` e `frontend/src/test/solicitacoes.test.tsx`.
- Tela de fila atual, histórico e exploração por categoria: `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx` (alterna `EscopoFila` entre `aberto`/`encerrado` e `ModoFila` entre `prioridade`/`categoria`).

## Alertas de manutenção

- O frontend pode esconder transições impossíveis, mas nunca decide uma transição.
- A fila é paginada; o resumo do painel vem de `GET /solicitacoes/resumo` e pode representar o conjunto global ou os filtros documentados.
- A fila é ordenada no backend para não quebrar paginação.
- `graphify-out` é artefato derivado; o mapa acima é o fallback humano quando a CLI não estiver instalada.
