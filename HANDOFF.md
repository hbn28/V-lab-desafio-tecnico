# HANDOFF.md

Reescrito a cada rodada pelo agente que acabou de trabalhar. O próximo agente (Claude Code ou Codex) lê este arquivo antes de tocar em qualquer código.

## Última tarefa concluída

Remoção, na tela de nova solicitação, dos textos “Use somente informações fictícias neste desafio.” e “Cadastre dados fictícios e descreva a necessidade de atendimento com clareza.”. A descrição do componente compartilhado passou a ser opcional para preservar o texto explicativo da tela de edição.

## Próxima tarefa

**Frontend: formulário de criação com validação** — revisar cobertura de cenários do formulário e marcar a tarefa somente quando os comportamentos obrigatórios estiverem protegidos.

## Bloqueios conhecidos

- Nenhum bloqueio funcional identificado.
- `npm install` reporta advisories em dependências de desenvolvimento; não executar correção forçada sem avaliar breaking changes.
- Vitest precisa ser executado fora da restrição local de leitura neste ambiente, pois o carregamento do `vite.config.ts` tenta acessar diretórios ancestrais.
- `npm run lint` não inicia porque o projeto usa ESLint 9 sem `eslint.config.js`; criar a configuração deve ser uma tarefa corretiva explícita.

## Estado de verificação desta rodada

- `npm test -- --run src/test/solicitacoes.test.tsx`: 10 testes passaram.
- `npm run build`: passou.
- `npm run lint`: bloqueado antes da análise por ausência de `eslint.config.js`.
- Inspeção visual desktop: dashboard e formulário conferidos no navegador local.
