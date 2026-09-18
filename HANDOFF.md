# HANDOFF.md

## Última tarefa concluída

Reconciliamos a documentação para agentes, corrigimos a configuração do ESLint 9, removemos a chave obsoleta do Compose e implementamos a fila operacional server-side: estados ativos primeiro, prioridade `URGENTE → ALTA → MEDIA → BAIXA`, mais antigas primeiro e `id` como desempate. A regra está documentada na spec, OpenAPI, arquitetura, README e ADR 001.

## Próxima tarefa

Executar a suíte backend em PostgreSQL e a revisão eliminatória com Docker Compose quando o daemon Docker estiver disponível. O CI permanece fora do escopo autorizado.

## Verificações desta rodada

- `npm run lint` — passou.
- `npm run build` — passou.
- `npm test -- --run src/test/solicitacoes.test.tsx` — 10 testes passaram.
- `docker compose config -q` — configuração válida; o Docker avisou que `version` era obsoleto, e o campo foi removido.
- Backend/Pest e revisão limpa — bloqueados: daemon Docker indisponível (`docker_engine` não encontrado).
- Graphify — relatório existente lido; CLI não está disponível no PATH. `docs/codebase-map.md` é o fallback humano.

## Bloqueios conhecidos

- Testes PostgreSQL e revisão integrada aguardam Docker Desktop/daemon ativo.
- O relatório Graphify derivado precisa ser atualizado após alterações quando a CLI estiver disponível.
- Advisories de desenvolvimento permanecem documentados; não executar correção forçada de dependências.
