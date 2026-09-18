# Mapa rápido do código

## Fluxo principal

```text
frontend/src/features/solicitacoes/pages
  -> hooks/useSolicitacoes.ts
  -> api/client.ts
  -> backend/routes/api.php
  -> SolicitacaoController
  -> FormRequest / Action / Resource
  -> PostgreSQL (Solicitacao + protocolo_counters)
```

## Pontos de extensão

- Regras de criação e protocolo: `backend/app/Domain/Solicitacoes/Actions/CriarSolicitacao.php`.
- Máquina de estados: `AtualizarStatusSolicitacao.php`.
- Ordenação da fila: `SolicitacaoController::index()`.
- Contrato de saída: `SolicitacaoResource.php` e `frontend/src/features/solicitacoes/types/index.ts`.
- Cliente e envelope de erro: `frontend/src/features/solicitacoes/api/client.ts`.
- Tokens e responsividade: `frontend/src/index.css` e `docs/design-system.md`.
- Testes de comportamento: `backend/tests/Feature/` e `frontend/src/test/solicitacoes.test.tsx`.

## Alertas de manutenção

- O frontend pode esconder transições impossíveis, mas nunca decide uma transição.
- O resumo da tela inicial é da página carregada, não um agregado global.
- A fila é ordenada no backend para não quebrar paginação.
- `graphify-out` é artefato derivado; o mapa acima é o fallback humano quando a CLI não estiver instalada.
