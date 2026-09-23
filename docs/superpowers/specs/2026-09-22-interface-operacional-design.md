# Especificação — Interface operacional limpa e consistente

**Status:** proposta aprovada em conversa; aguardando revisão desta especificação escrita.  
**Data:** 2026-09-22  
**Escopo:** experiência completa do frontend de Solicitações de Atendimento, incluindo suporte necessário na API para busca, filtros, ordenação e agenda semanal.

## Objetivo e entendimento aprovado

Reduzir ruído e tornar o sistema intuitivo para a equipe que registra, triageia, agenda e acompanha solicitações de atendimento público. As telas devem responder rapidamente: o que exige atenção, como localizar um registro e qual é a próxima ação possível.

O sistema deve oferecer busca, filtros e ordenação coerentes em todas as coleções de solicitações. A fila principal continua priorizando urgência e antiguidade por padrão; a agenda respeita a data e o horário marcados por padrão, mas permite ordenar por prioridade. Uma visão de sete dias deve apresentar uma fila própria por dia. Textos sem ganho operacional serão removidos, sem eliminar mensagens necessárias para erros, validação, orientação, consequências e acessibilidade.

## Referências e princípios

- [DWP Design System — Filters](https://design-system.dwp.gov.uk/contribute/filters): filtros opcionais, feedback visível, estado mantido, remoção individual ou total e combinação AND entre categorias.
- [GOV.UK Design System — Table](https://design-system.service.gov.uk/components/table/): tabela para comparação e leitura rápida de registros.
- [NHS Digital Service Manual — Inclusion and accessibility](https://service-manual.nhs.uk/standards-and-technology/service-standard-points/5-make-sure-everyone-can-use-the-service): linguagem simples, inclusão e acessibilidade WCAG 2.2 AA.
- UI/UX Pro Max: busca local para `product` de administração/gestão de casos, padrões React e `minimalism-and-swiss-style`. O resultado genérico de dashboard de marketing/neumorfismo foi descartado como inadequado para uma ferramenta interna operacional.

Princípios resultantes: conteúdo antes de decoração; controles opcionais e previsíveis; rótulos explícitos; prioridade nunca indicada somente por cor; feedback imediato e reversível; paginação e consultas aplicadas ao conjunto completo no servidor; responsividade sem rolagem horizontal da página.

## Estado atual observado

- `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx` concentra fila, agenda de um dia, histórico/visões, resumo, faltas e filtros locais. A listagem aceita status, categoria, prioridade, data agendada em determinados contextos e paginação.
- `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php` determina a ordenação operacional no servidor. A fila usa prioridade e antiguidade; `AGENDADA` usa data/hora marcada e prioridade como desempate. A API não deve perder esse comportamento por reordenação local.
- `frontend/src/features/solicitacoes/components/DrilldownModal.tsx` abre coleções filtradas pelo resumo de prioridade/status e já possui gestão de foco.
- A agenda atual consulta um dia por URL (`?visao=agenda&data=YYYY-MM-DD`). O endpoint já contempla agendamento de horário e de turno.
- Histórico, faltas, formulário de cadastro, detalhe, autenticação e notificações são fluxos separados ou compartilhados conforme o mapa humano e o grafo Graphify existente. A CLI Graphify não está instalada; a estrutura do grafo foi consultada por traversal local de leitura.
- O formulário já marca `Celular (opcional)`, só o envia quando preenchido e o backend valida como `nullable`. O edital não o inclui entre os campos mínimos. A mudança visual não deve tornar celular obrigatório nem enfraquecer a mascaragem atual.
- Mensagens como “Painel considerando todas as solicitações — não apenas as desta página”, explicações repetidas da ordenação e textos genéricos de carregamento ocupam espaço sem apoiar uma decisão. A nota de telefone mascarado e mensagens de erro/validação têm valor e devem ser preservadas, com concisão.

## Abordagem escolhida

Adotar um **espaço operacional compacto** com navegação estável entre Fila, Solicitações agendadas, Histórico e Faltas. Busca, filtros e ordenação compartilham o mesmo modelo mental e só mostram opções aplicáveis ao conjunto atual. O resumo mantém valor como atalho, mas não duplica a primeira solicitação nem exige um parágrafo sobre seu escopo.

Não adotar uma tela de cartões como mecanismo principal (esconderia listas e controles) nem substituir toda a experiência por um calendário (dificultaria a triagem sem agendamento). Não introduzir biblioteca visual ou abstrações de backend sem necessidade comprovada.

## Arquitetura da informação e conteúdo

1. **Fila:** solicitações abertas primeiro; resumo compacto; busca/filtros/ordenação junto à lista; registro inicial da fila claramente identificável.
2. **Solicitações agendadas:** janela de sete dias, hoje até hoje + seis dias, com navegação em intervalos consecutivos de sete dias. Cada dia é um grupo/fila separado, recolhível em telas compactas, contado e navegável. Datas permanecem na ordem cronológica.
3. **Histórico:** concluídas e canceladas, com ferramentas de localização e ordenação por data de encerramento/atualização ou prioridade.
4. **Faltas:** atendimentos perdidos, com acesso claro ao contato e reagendamento; busca e filtros coerentes com prioridade, data do atendimento perdido e situação do contato.
5. **Resultados de resumo/drill-down:** controles comuns e estado mantido. Um filtro fixo que define o próprio contexto (por exemplo, prioridade no drill-down de prioridade) não é repetido como controle inútil; busca, demais filtros relevantes e ordenação por data permanecem disponíveis.
6. **Detalhe/formulários:** ao voltar à coleção, preservar os parâmetros da busca, filtros, ordenação, período e página. Dar precedência visual a protocolo, prioridade, status, horário/data e ação permitida; organizar o cadastro e a descrição após esse resumo.
7. **Notificações:** manter como feed de eventos (ordem temporal, mais recente primeiro), não como uma segunda fila de trabalho. Não adicionar filtros de solicitação ao feed sem evidência de que ele é usado para triagem.

## Busca, filtros e ordenação

### Interação comum

- Coleções de solicitações oferecem busca por protocolo ou nome; filtros opcionais adequados ao contexto; seletor “Ordenar por”; contagem de resultados; estado dos filtros ativos e remoção individual ou “Limpar filtros”.
- Filtros de categorias diferentes combinam por AND; múltiplos valores dentro da mesma categoria seguem a semântica da seleção. O resultado e a contagem refletem a consulta inteira.
- Aplicar filtros é deliberado: selecionar critérios não muda a lista até acionar “Aplicar”. Alterar busca pode ser submetido por Enter ou após debounce; não disparar uma chamada em cada tecla sem controle.
- Consulta, ordenação, intervalo e paginação ficam representados na URL onde fizer sentido, permitindo link, atualização de página e navegação voltar/avançar. Ao alterar critério, voltar à primeira página.
- Busca/filtros/ordenação/paginação são server-side; não ordenar apenas os itens carregados naquela página. O backend aceita apenas campos e direções allowlisted e mantém desempate determinístico por protocolo/id.
- Opções de ordenação disponíveis são contextuais, mas seus nomes e sentidos são uniformes. Opções sem efeito no conjunto (por exemplo, ordenar data numa lista fixada a um único dia) não aparecem.

### Semântica de ordenação

| Critério | Sentido | Campo de data de desempate/contexto |
|---|---|---|
| Prioridade | URGENTE → ALTA → MÉDIA → BAIXA | Mais antiga primeiro; horário marcado quando a coleção é de agendamentos |
| Data | Mais antiga ou mais recente, conforme opção explícita | Fila: criação; agendados: data do compromisso; faltas: data/hora perdida; histórico: atualização/encerramento |
| Horário | Mais cedo ou mais tarde, apenas quando existe hora exata | Dentro do dia, e prioridade no empate |

`Prioridade` é uma classificação administrativa do desafio, não um algoritmo clínico. Nenhuma ordenação deve inferir risco médico nem quebrar a hora marcada silenciosamente. Quando a pessoa escolhe ordenar a agenda por prioridade, cada data/hora continua em destaque na linha.

### Matriz de coleções

| Coleção | Filtros | Ordenações aplicáveis | Padrão |
|---|---|---|---|
| Fila principal | protocolo/nome, status, categoria, prioridade; data marcada quando status for AGENDADA | prioridade, data de criação; horário se forem solicitações agendadas | prioridade; mais antigas primeiro no empate |
| Solicitações agendadas (sete dias) | protocolo/nome, prioridade, categoria, período; status apenas se necessário | prioridade ou horário dentro de cada grupo diário. Data/grupo sempre cronológico. Agendamento por turno ordena turno, depois prioridade | horário; prioridade desempata |
| Histórico | protocolo/nome, status final, categoria, prioridade e período | prioridade ou data de encerramento/atualização; horário se útil e disponível | mais recentes encerradas primeiro, seguindo comportamento atual |
| Faltas | protocolo/nome, prioridade, data do atendimento perdido e situação do contato | prioridade ou data/hora perdida; hora somente quando horário exato existir | prioridade; falta mais antiga primeiro no empate |
| Drill-down de prioridade/status | filtros que não sejam inerentes ao contexto; protocolo/nome; período quando aplicável | prioridade se variar, data e horário quando aplicáveis | preservar regra operacional do contexto |

Em qualquer conjunto de prioridade única, o critério de prioridade não precisa aparecer como escolha sem efeito; a prioridade continua visível e desempates usam data e horário definidos acima.

## Agenda semanal

- Título e navegação usam “Solicitações agendadas”, e não o rótulo isolado “Agenda”.
- A janela inicial abrange hoje e seis dias seguintes; anterior/próxima desloca sete dias. O período pode ser refinado por filtros de data.
- Se período ou busca produz vários dias, manter grupos de dias em ordem cronológica; cada grupo tem contagem, lista e estado vazio conciso.
- Cada dia permite “Horário” e “Prioridade”. “Horário” mantém os horários exatos em ordem cronológica, usa prioridade no empate e agrupa a modalidade de turno por MANHÃ/TARDE/NOITE. “Prioridade” ordena a prioridade dentro daquele dia e mantém horário/turno visível; não muda a data do atendimento.
- Aplicar filtro de data a um só dia remove a ordenação por data dos controles daquele resultado, mas não a ordenação por prioridade/horário. Um intervalo ainda admite ordenação por data nas coleções que não agrupam os dias visualmente.
- O filtro existente que une horário exato (`agendado_para`) e modalidade turno (`data_agendada`) permanece íntegro, usando `America/Recife` conforme a configuração vigente.

## Revisão de textos e estados

- Remover a frase de escopo global do painel e frases que apenas descrevam a ordenação já indicada pelos controles.
- Remover o cartão duplicado de “Próxima solicitação por prioridade” quando ele repetir o primeiro item ordenado; a primeira linha/registro é a próxima ação operacional.
- “Aberto há N dias” só deve reaparecer se existir um limite de atendimento configurado que permita comunicar atraso real. Sem SLA, antiguidade pode ser critério de ordenação ou coluna de data, mas não mensagem de atraso.
- Manter estados de erro com recuperação, validação inline ligada ao campo, resumo acessível de erros de formulário, confirmação de exclusão, conflito concorrente, estado terminal e mensagens de sucesso necessárias.
- Estados vazios devem indicar a causa e uma ação útil somente quando aplicável (limpar filtro, trocar dia ou criar primeira solicitação). Estado de carregamento deve ter anúncio acessível curto, sem “buscando dados mais recentes” genérico.
- Celular continua opcional. Ajuda concisa: “Usado para contato em caso de falta; exibido mascarado.” Número completo nunca aparece em lista/detalhe nem em logs.
- Status e prioridade usam rótulos explícitos além da cor. Ícones puramente decorativos não substituem texto.

## Direção visual e acessibilidade

- Ferramenta profissional de baixa ornamentação: fundo neutro, superfícies claras, texto escuro, uma cor principal sóbria para ações, bordas discretas e sombra mínima. Preservar tokens compartilhados do projeto e evitar cores ad hoc.
- Hierarquia tipográfica clara e regular; informações comparáveis em tabelas/listas alinhadas. Uma superfície por grupo funcional; sem cartões decorativos aninhados, gradientes ou densidade visual desnecessária.
- Desktop: navegação horizontal estável, conteúdo focado e tabela legível. Mobile: navegação compacta acessível, filtros recolhidos sem ocultar o estado ativo e cada item convertido em cartão sem perda dos mesmos campos/ações.
- Teclado completo, foco visível e não obstruído, semântica correta, contraste WCAG AA, alvo interativo confortável, suporte a zoom/reflow e preferência `prefers-reduced-motion`. Modal preserva armadilha e retorno de foco; notificações não deslocam foco ao atualizar.
- Formulário preserva autofill/gerenciador de senha onde aplicável, labels persistentes, erros ligados ao campo e celular opcional.
- Não se afirma conformidade apenas por testes automatizados; validar navegação manual, tamanho 320/375 px, tablet e desktop.

## Mudanças técnicas esperadas (a detalhar no plano)

- Frontend React/TypeScript: layout/navegação, página operacional, componente comum de toolbar para coleções, parâmetros de busca, filtros, ordenação e paginação, agrupamento semanal, links de retorno que preservam consulta, cópia, CSS/tokens e testes de interação/acessibilidade.
- Backend Laravel: ampliar Requests/Actions/Resources/endpoints existentes para busca, filtros contextuais e ordenação allowlisted, paginação estável e contagens; adicionar critérios aos endpoints de faltas se atualmente necessário. Seguir FormRequest → Action → Resource; sem Repository, CQRS ou regra de negócio em Controller.
- Testes: Pest/PostgreSQL para validação e ordem server-side, limites de filtros, dia/turno/fuso e paginação; Vitest com clientes HTTP mockados para cada coleção, query string e back/forward, aplicação/remoção de filtros, ordenações, estados vazios/erro e teclado.
- Preservar contrato do desafio: React + TypeScript, Laravel API, PostgreSQL; máquina de estados permanece em `AtualizarStatusSolicitacao`; regra de protocolo, transações, autorização, privacidade e integrações já implementadas não são redesenhadas.

## Fora de escopo

- Classificação clínica automática ou regras de triagem além de prioridade administrativa existente.
- Alterar status/transições, introduzir SLA inexistente, mexer em cadastro obrigatório ou tornar celular obrigatório.
- Calendarização de mês completo, drag-and-drop de horários, capacidade de profissional, check-in, espera em tempo real ou alterações de horário em lote.
- Rebranding, troca da stack ou dependência visual nova sem justificativa.
- Reformular o feed de notificações como uma fila; este continua ordenado por data do evento.

## Critérios de aceitação

1. A mesma coleção mostra busca, filtros, ordenação contextual, contagem e filtros removíveis; operações atravessam todas as páginas no servidor.
2. Critérios e paginação persistem na URL e são preservados ao entrar/sair do detalhe; mudar consulta reseta para página 1.
3. A visão semanal mostra sete filas diárias, navegáveis, agrupadas cronologicamente; hora e prioridade podem ser escolhidas dentro do dia sem ocultar hora/data.
4. Fila default e tie-breaker permanecem conforme contrato. Nenhum ordenamento no cliente contradiz o servidor.
5. Mensagens redundantes identificadas são removidas, mantendo erros, validações, consequências, vazios acionáveis e semântica assistiva.
6. Campo de celular permanece opcional e mascarado em toda saída.
7. Telas principais mantêm estados loading/success/empty/error e passam revisão de teclado, contraste, zoom e 320px até desktop.
8. Testes de backend/frontend provam critérios acima; nenhum teste frontend faz chamada real.

## Questões já decididas

- Direção: espaço operacional compacto.
- Busca/filtro/ordenação em todas as coleções de solicitações, incluindo resultados de drill-down, com opções só quando aplicáveis.
- Agenda semanal de sete dias, agrupada por data; horário é default e prioridade é alternativa explícita.
- Ordem de prioridade visível em toda coleção; opções contextuais por prioridade/data/horário, com data aplicável conforme o significado da coleção e suprimida em um único dia.
- Revisão de textos e simplificação visual de todas as telas sem remover feedback necessário.
- Celular opcional, conforme edital e API atuais.
