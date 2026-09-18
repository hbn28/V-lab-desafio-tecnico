# ADR 002 — Evolução do painel da fila (feature principal)

## Contexto

O painel (`SolicitacoesPage`) é a tela de entrada e a feature central do sistema: é
onde o atendente decide o que fazer a seguir. Depois de três rodadas de ajuste
(contagens globais via `GET /solicitacoes/resumo`, drill-down por bloco, fusão do
andamento da fila numa tira compacta com destaque do filtro ativo), o pedido agora
é estrutural: tornar o painel **mais dinâmico e mais claro**, já que é a feature
principal do produto — não mais um ajuste pontual de um bloco.

## Diagnóstico

O que hoje limita "dinâmico" e "claro":

1. **Sem atualização automática.** `resumo` e a listagem só buscam dados ao montar
   a página ou ao trocar um filtro. Se outro atendente muda um status, ou se o
   tempo passa com a página aberta, os números ficam parados até um F5. Para uma
   fila de atendimento isso é o oposto de "dinâmico" — é uma foto, não um painel.
2. **Nenhum sinal de urgência real (tempo de espera).** Os cartões mostram
   contagem ("Urgente: 1"), mas não há nenhuma pista de **há quanto tempo** essa
   solicitação urgente está esperando. Um "1" parado há 10 minutos e um "1"
   parado há 3 dias exigem reações muito diferentes, e o painel não distingue.
3. **Painel é informativo, não acionável.** O atendente vê os números, mas
   precisa descer até a tabela e procurar manualmente qual é a próxima
   solicitação a atender — mesmo a API já definindo essa ordem
   (`docs/decisions/001-prioridade-da-fila.md`). O painel não expõe essa decisão
   já calculada.
4. **Dois mecanismos de filtro em paralelo.** Os cartões/pills abrem uma janela
   de drill-down com seus próprios filtros; a barra de filtros abaixo da tabela
   filtra a listagem principal. São dois sistemas que replicam a mesma regra de
   negócio (categoria/prioridade/status) em dois lugares — e boa parte do
   trabalho das últimas rodadas foi manter os dois sincronizados. Isso é sinal de
   complexidade acidental, não de uma escolha deliberada.

## Opções avaliadas

| Melhoria | Custo | Ganho "dinâmico" | Ganho "claro" | Risco |
|---|---|---|---|---|
| **A. "Próximo atendimento"** — cartão de destaque no topo com a solicitação #1 na ordem da fila e um botão "Atender" direto para o detalhe | Baixo | Médio | Alto | Baixo |
| **B. Atualização silenciosa em segundo plano** — `resumo` (consulta leve, já agregada) revalidado a cada ~30s e ao voltar o foco na aba, sem piscar loading | Baixo | Alto | Baixo | Baixo — precisa pausar enquanto o drill-down está aberto, pra não fechar a janela do usuário |
| **C. Indicador de antiguidade por prioridade** — "a mais antiga está esperando há 2 dias" nos cartões de Urgente/Alta | Baixo-médio | Médio | Alto | Baixo — 1 campo novo no `resumo` (`MIN(created_at)` por prioridade, mesma consulta) |
| **D. Unificar drill-down com a barra de filtros** — cartão/pill aplica o filtro real da página e rola até a tabela, em vez de abrir uma janela paralela | Médio (refatoração) | Médio | Alto | Médio — muda uma interação já validada com o usuário nas rodadas anteriores |
| E. Barra empilhada prioridade×etapa num único gráfico | Médio-alto | Baixo | Médio | Médio — mais peso visual e decisão de design, ganho incerto |
| F. Tempo real via WebSocket/SSE (Reverb, Pusher) | Alto | Alto | — | Alto — infraestrutura nova (broadcasting, mais um serviço no Compose); contraria a diretriz do próprio `AGENTS.md` de não acrescentar camada sem benefício demonstrado, e é desproporcional para uma ferramenta interna de escala pequena avaliada num desafio técnico |

## Recomendação

Priorizar **A, B e C** nesta rodada: custo baixo, mexem exatamente nos três
pontos que tornam o painel estático hoje (sem atualização, sem senso de tempo,
sem ação direta), e não exigem infraestrutura nova. **D** é arquiteturalmente
correto (elimina a duplicação de regras de filtro) mas é uma refatoração de uma
interação já testada com o usuário — vale como próximo passo deliberado, não
bundled sem aviso. **E** fica descartado por ora: peso visual alto para um
ganho incerto de clareza. **F** fica registrado como evolução futura, no mesmo
espírito do parágrafo de evolução já existente em `docs/architecture.md`.

## Fora de escopo (por quê)

Tempo real via WebSocket exige um serviço de broadcasting rodando (Reverb ou
equivalente), mais uma dependência no `docker-compose.yml`, e um cliente de
assinatura no frontend — investimento de infraestrutura que não se paga para
uma ferramenta interna de uma organização, e que o próprio `AGENTS.md` pede pra
evitar sem benefício demonstrado. Polling leve (opção B) entrega a maior parte
da sensação de "painel vivo" a uma fração do custo.

## Verificação

Cobertura por teste de feature (backend, para os campos novos no `resumo`) e
teste de componente (frontend, para o cartão de próximo atendimento e o
polling silencioso, com fake timers).
