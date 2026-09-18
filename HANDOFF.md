# HANDOFF.md

Reescrito a cada rodada pelo agente que acabou de trabalhar. O próximo agente (Claude Code ou Codex) lê este arquivo antes de tocar em qualquer código.

## Última tarefa concluída

Aplicação da direção visual **A — Institucional contemporâneo** no frontend React:

- design system documentado em `docs/design-system.md` e implementado com tokens primitivos/semânticos em `frontend/src/index.css`;
- rota `/` transformada na tela inicial real; `/solicitacoes` preservada como redirecionamento compatível;
- dashboard com resumo por status explicitamente limitado à página carregada;
- listagem, filtros, paginação, estados assíncronos e adaptação da tabela para celular;
- formulário acessível com labels associados, erros inline e resumo focalizável;
- detalhe responsivo com feedback de sucesso/erro para atualização de status;
- contrato interno alinhado aos campos já implementados `cpf_solicitante` e `data_nascimento`, sem migration nova e sem alteração nos endpoints.

Testes TDD adicionados para rota inicial, resumo por status, associação dos campos e foco do resumo de erro.

## Próxima tarefa

**Frontend: formulário de criação com validação** — revisar cobertura de cenários do formulário e marcar a tarefa somente quando os comportamentos obrigatórios estiverem protegidos.

## Bloqueios conhecidos

- Nenhum bloqueio funcional identificado.
- `npm install` reporta advisories em dependências de desenvolvimento; não executar correção forçada sem avaliar breaking changes.
- Vitest precisa ser executado fora da restrição local de leitura neste ambiente, pois o carregamento do `vite.config.ts` tenta acessar diretórios ancestrais.
- `npm run lint` não inicia porque o projeto usa ESLint 9 sem `eslint.config.js`; criar a configuração deve ser uma tarefa corretiva explícita.

## Estado de verificação desta rodada

- `npm test -- --run`: 6 testes passaram.
- `npm run build`: passou.
- `npm run lint`: bloqueado antes da análise por ausência de `eslint.config.js`.
- Inspeção visual desktop: dashboard e formulário conferidos no navegador local.
