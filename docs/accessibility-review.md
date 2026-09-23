# Revisão de acessibilidade

Revisão registrada em 23/09/2026. O estado abaixo distingue evidência automatizada e inspeção manual para não declarar uma validação visual que não ocorreu.

## Verificações automatizadas

- `frontend/src/test/accessibility.test.tsx`: 3 testes passam, cobrindo nome acessível da navegação, ordem inicial de Tab com skip link, indicação de rota atual, rótulos do formulário e foco do diálogo com Tab/Shift+Tab, Escape e retorno ao acionador.
- Suíte frontend completa: `npm test -- --run` passou com 11 arquivos e 53 testes.
- Os testes por tela cobrem estados existentes: fila/lista (carregamento, sucesso e vazio; erro de validação e erro de rede), agenda semanal (carregamento por dia, sucesso, vazio e falha isolada com nova tentativa), faltas (sucesso, vazio e filtros), detalhe (sucesso e respostas 422/409), login (entrada anônima) e notificações (lista/leitura). Formulários cobrem submissão, sucesso e erros de campo.
- CSS: foco visível usa outline de 3 px no token `--color-focus`; há breakpoints em 48rem e 30rem e regras `prefers-reduced-motion: reduce` em `frontend/src/index.css`.

## Inspeção manual ainda necessária

Não houve navegador disponível para percorrer as telas renderizadas. Portanto, fila, solicitações agendadas, histórico, faltas, detalhe, formulários, login e notificações não foram auditados visualmente em 320 px, 768 px e desktop. Zoom de 200%, contraste calculado, ordem e visibilidade de foco em cada tela, leitores de tela, retorno de foco para todos os diálogos e tamanho de todos os alvos de toque continuam sem evidência manual. O teste do diálogo prova Escape e retorno do foco para esse componente; não substitui a checagem de todos os fluxos.

## Auditoria de viewport e consistência (23/09/2026)

Auditoria de código e comportamento automatizado, sem inspeção renderizada. Foram localizados e corrigidos riscos claros em `frontend/src/index.css`: o painel de notificações perdia `overflow:auto` para `.panel`; no breakpoint móvel o popup ancorava no lado direito do botão à esquerda; o cabeçalho e a navegação não refluíam em larguras intermediárias; a tabela da fila era recortada pelo painel; e os filtros do drill-down exigiam largura maior que o corpo do modal. A tabela agora é uma região focável e rolável. Essas regras foram revisadas no CSS e exercitadas por testes de componente/teclado quando aplicável, mas não comprovam pixels calculados pelo navegador.

A auditoria também corrigiu consistência de identidade ao editar CPF, exibição e prefill de agendamento por turno, criação de falta pela tela de detalhe, retirada de faltas da agenda ativa, erro visível em conflito de reagendamento, respostas antigas de filtros, acesso a notificações além das primeiras 20 e divergências dos tipos/OpenAPI para contato e fila.

Os testes Vitest cobrem foco inicial, Tab/Shift+Tab, Escape e retorno do foco no modal e nas notificações; casos de turno, falta, conflito, paginação de notificações, carregamento independente da agenda e respostas concorrentes. A revisão de código adicional corrigiu o cartão de faltas em largura estreita, a toolbar do modal em desktop, o erro de contato dentro do diálogo e a preservação dos filtros em edição. Contrast ratios, zoom a 200%, alvo de toque efetivo e renderização real em 320 px, 768 px e desktop continuam sem medição nesta sessão. Um navegador automatizável não estava disponível; por isso, a conclusão deste documento é de correções estáticas e testes de componente, não de aprovação visual completa.

## Browser follow-up (2026-09-23)

This section supersedes the earlier statements that no browser was available and that all viewport inspection remained pending. Chrome was driven against an isolated API/database with synthetic records. Fila, agenda, historico, faltas, detalhe, create/edit forms, login and notificacoes were inspected at CSS viewport widths 320, 768 and 1280 px.

- No document-level horizontal overflow was observed at these widths. At 320 px the navigation is internally horizontally scrollable; elements outside its initial strip belong to that scroll region. The bounds check found no off-screen elements at 768 or 1280 px.
- Automated keyboard tests cover the skip link, form labels, modal focus containment, Escape and focus return. The browser flow confirmed Escape and focus return in the contact dialog.
- Browser flows exercised invalid form feedback, invalid login feedback, filters/search, schedule transitions, early absence rejection, contact recording and rebooking. Loading/empty/network error states are component-tested; they were not manually forced on every route.
- Still unmeasured: 200% browser zoom, computed contrast ratios, every touch target's pixel size, screen-reader behavior and browser-level prefers-reduced-motion. CSS rules alone are not evidence for those checks.
- Temporary screenshots were removed after inspection. Functional flow evidence and command results are summarized in docs/functional-audit.md.
