# Manual de trabalho para agentes

## Antes de editar

1. Leia `AGENTS.md`, `HANDOFF.md`, `docs/spec.md` e `TASKS.md`.
2. Consulte `docs/codebase-map.md`; use Graphify quando o executável estiver disponível.
3. Escolha uma única tarefa marcada como próxima. Não reabra trabalho concluído sem evidência de regressão.
4. Para mudança de comportamento, escreva primeiro o teste que deve falhar.

## Durante a tarefa

- Reutilize Actions, Requests, Resources, hooks e tokens existentes.
- Não crie Repository, DTO, CQRS ou abstração de uma implementação sem benefício demonstrável.
- Preserve validação, erros, segurança, acessibilidade e prevenção de perda de dados.
- Em alterações que atravessam frontend, API e banco, atualize contrato e teste na mesma rodada.
- Não trate o frontend como autoridade de negócio; a API e o PostgreSQL são a fonte final.

## Antes de encerrar

- Rode a verificação específica, depois build/lint/testes afetados.
- Registre comandos, resultado e bloqueios reais em `HANDOFF.md`.
- Atualize `TASKS.md` somente com evidência.
- Se código foi alterado e Graphify estiver disponível, execute `graphify update .`.
- Não altere CI nesta fila sem tarefa explícita.

## Fontes de verdade

`docs/spec.md` define dados e API; `docs/design-system.md` define a linguagem visual; `AGENTS.md` define regras do repositório; `HANDOFF.md` define o estado da última rodada. Este manual explica o processo, mas não substitui esses documentos.
