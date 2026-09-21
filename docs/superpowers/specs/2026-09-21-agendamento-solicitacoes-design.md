# Arquitetura da agenda de solicitações

**Data:** 21 de setembro de 2026

**Status:** proposta para revisão

**Escopo:** extensão do domínio de solicitações com data e hora de atendimento

## 1. Objetivo

Adicionar ao sistema uma agenda operacional na qual o atendente escolhe livremente a data e a hora de uma solicitação, sem alterar a máquina de estados exigida pelo desafio.

O agendamento será concluído somente quando os dois campos obrigatórios — data e hora — forem válidos. O sistema permitirá que mais de uma solicitação seja marcada para o mesmo instante. Portanto, igualdade de data e hora não representa conflito nesta versão; a ordem de atendimento continua sendo determinada pela prioridade operacional da solicitação e, em caso de empate, por uma ordenação determinística.

## 2. Compatibilidade com o desafio

O desafio exige o status `AGENDADA`, a transição `EM_ANALISE → AGENDADA` e a consulta e atualização do status. Ele não define calendário, capacidade, duração, profissional, sala ou exclusividade de horários.

Esta extensão é compatível porque:

- preserva todos os estados e transições existentes;
- mantém `AtualizarStatusSolicitacao` como única fonte de verdade para transições;
- apenas fortalece a pré-condição da transição para `AGENDADA`;
- não cria um estado adicional;
- não altera prioridade, categoria ou protocolo;
- não presume que um horário represente uma vaga exclusiva.

O campo de data e hora é informação complementar do estado `AGENDADA`, não uma nova etapa da máquina de estados.

## 3. Requisitos funcionais

### 3.1 Agendamento inicial

- Uma solicitação só pode ser agendada a partir de `EM_ANALISE`.
- Para alterar o status para `AGENDADA`, data e hora são obrigatórias.
- A combinação deve representar um instante futuro no fuso operacional.
- Segundos não são informados pelo usuário e são normalizados para zero.
- Solicitações diferentes podem ter exatamente a mesma data e hora.
- A operação altera status e data/hora na mesma transação.

### 3.2 Reagendamento

- Somente uma solicitação em `AGENDADA` pode ser reagendada.
- Data e hora continuam obrigatórias.
- Reagendar não muda o status.
- Reenviar o mesmo instante é uma operação idempotente e retorna sucesso sem alteração efetiva.
- Não será permitido apagar a data/hora de uma solicitação `AGENDADA`.

### 3.3 Consulta da agenda

- O atendente pode escolher o dia que deseja consultar.
- A agenda exibe apenas solicitações `AGENDADA` daquele dia operacional.
- A data escolhida fica refletida na URL para preservar navegação, recarregamento e compartilhamento.
- O dia selecionado permanece estável enquanto a tela está aberta; uma virada de meia-noite não troca o contexto silenciosamente.
- Um dia sem registros apresenta estado vazio, e não erro.

### 3.4 Ordem operacional

Na visão de agenda, os registros são ordenados por:

1. data e hora crescentes;
2. prioridade operacional: `URGENTE`, `ALTA`, `MEDIA`, `BAIXA`;
3. protocolo em ordem crescente;
4. identificador em ordem crescente como desempate final.

A agenda não registra chegada ao local. A ordem real de chegada permanece fora do sistema. Comorbidades, preferência legal e outras condições pessoais não serão inferidas nem usadas automaticamente para reordenar a fila nesta entrega.

Na fila atual, o cartão hoje denominado “Próximo atendimento” será renomeado para “Próxima solicitação por prioridade”, mantendo a regra já existente. O próximo horário agendado será apresentado somente na visão de agenda, evitando misturar fila de triagem com agenda cronológica.

## 4. Requisitos não funcionais

- Toda mudança de status ou de agendamento deve ocorrer em transação e usar `lockForUpdate`.
- A aplicação permanece com timezone interno UTC.
- A interpretação da data e hora digitadas usa o fuso operacional configurado.
- Erros de entrada retornam HTTP 422; conflitos de estado retornam HTTP 409.
- As respostas de erro preservam o contrato `{ message, errors }`.
- A API não aceita campos desconhecidos nas operações de agendamento.
- Tipos TypeScript espelham o contrato da API e não usam `any`.
- Os testes de regras, constraints e concorrência usam PostgreSQL.
- A interface cobre carregamento, sucesso, vazio e erro.
- A interface atende WCAG AA e mantém controles com pelo menos 44 px de altura.

## 5. Decisão de arquitetura

Foram consideradas três alternativas:

1. **Colocar a data/hora apenas na atualização genérica de status.** É simples para o agendamento inicial, mas torna o reagendamento artificial e mistura alteração de status com edição de agenda.
2. **Criar endpoints separados para agendar e reagendar.** Torna a intenção explícita, mas corre o risco de criar uma segunda autoridade para a transição `EM_ANALISE → AGENDADA`.
3. **Modelo híbrido.** O agendamento inicial usa a atualização de status existente, enquanto o reagendamento usa um endpoint específico que não altera status.

A alternativa escolhida é o modelo híbrido:

- `PATCH /api/v1/solicitacoes/{id}/status` continua responsável pela transição para `AGENDADA` e exige data/hora nesse caso;
- `PATCH /api/v1/solicitacoes/{id}/agendamento` altera somente o instante de uma solicitação que já está `AGENDADA`;
- `AtualizarStatusSolicitacao` continua sendo a única Action capaz de alterar o status.

Essa separação preserva o contrato arquitetural do projeto e evita sobrecarregar o endpoint de status com uma edição que não muda o estado.

## 6. Modelo de dados

### 6.1 Coluna

Adicionar à tabela `solicitacoes`:

```text
agendado_para TIMESTAMP WITH TIME ZONE NULL
```

O valor será persistido em UTC. Não haverá índice único, porque horários coincidentes são permitidos.

Adicionar índice simples em `agendado_para` para consultas por intervalo e ordenação da agenda.

### 6.2 Invariantes no banco

As seguintes invariantes também serão protegidas por constraints:

```sql
CHECK (status <> 'AGENDADA' OR agendado_para IS NOT NULL)
CHECK (status NOT IN ('RECEBIDA', 'EM_ANALISE') OR agendado_para IS NULL)
```

Consequências:

- `RECEBIDA` e `EM_ANALISE` nunca possuem agendamento;
- `AGENDADA` sempre possui agendamento;
- `CONCLUIDA` preserva o agendamento quando ele existe, mas pode continuar nula para dados históricos;
- `CANCELADA` preserva o agendamento quando o cancelamento ocorreu depois de agendar, mas pode ser nula quando cancelada antes disso.

Não será criada constraint de unicidade para `agendado_para`.

### 6.3 Migração de registros existentes

A migração seguirá esta ordem:

1. criar a coluna anulável;
2. criar o índice;
3. converter registros existentes em `AGENDADA` para `EM_ANALISE`;
4. instalar as constraints.

Essa estratégia evita inventar datas para registros sem informação real. Registros históricos em `CONCLUIDA` permanecem válidos mesmo que não possuam agendamento. Em uma instalação nova, seeders de registros `AGENDADA` devem sempre preencher `agendado_para`.

## 7. Data, hora e fuso operacional

O backend continua configurado em UTC. O fuso operacional da agenda será `America/Recife`, configurável por ambiente:

```text
AGENDAMENTO_TIMEZONE=America/Recife
VITE_AGENDAMENTO_TIMEZONE=America/Recife
```

As duas configurações devem representar o mesmo fuso e serão documentadas em `.env.example` e no Docker Compose. Nenhuma delas altera o timezone global do Laravel.

Regras de conversão:

- entrada: `data_agendada` em `YYYY-MM-DD` e `hora_agendada` em `HH:mm`;
- interpretação: combinação no fuso `AGENDAMENTO_TIMEZONE`;
- persistência e resposta: instante UTC em ISO 8601;
- apresentação: conversão para `VITE_AGENDAMENTO_TIMEZONE`;
- comparação com “agora”: feita após a combinação em um instante absoluto;
- consulta diária: intervalo UTC semiaberto correspondente a `[início do dia local, início do dia local seguinte)`.

O intervalo semiaberto evita sobreposição entre dias e permanece correto caso o fuso configurado tenha mudança de horário sazonal.

## 8. Contrato da API

### 8.1 Agendamento inicial

```http
PATCH /api/v1/solicitacoes/{id}/status
Content-Type: application/json

{
  "status": "AGENDADA",
  "data_agendada": "2026-09-25",
  "hora_agendada": "14:30"
}
```

Para qualquer outro status, `data_agendada` e `hora_agendada` não são aceitas. Para `AGENDADA`, ambas são obrigatórias.

Resposta de sucesso: HTTP 200 com a representação atualizada da solicitação.

### 8.2 Reagendamento

```http
PATCH /api/v1/solicitacoes/{id}/agendamento
Content-Type: application/json

{
  "data_agendada": "2026-09-28",
  "hora_agendada": "09:00"
}
```

Resposta de sucesso: HTTP 200 com a representação atualizada. Se o instante for igual ao atual, a resposta continua sendo 200 e nenhum dado é alterado.

### 8.3 Consulta diária

```http
GET /api/v1/solicitacoes?status=AGENDADA&data_agendada=2026-09-25
```

`data_agendada` é um filtro de agenda e implica `status=AGENDADA` quando o status não é enviado. Se um status incompatível for enviado com esse filtro, a API responde 422. A paginação existente é preservada e volta à primeira página quando a data muda.

### 8.4 Representação da solicitação

A resposta adiciona:

```json
{
  "agendado_para": "2026-09-25T17:30:00Z"
}
```

O campo é `string | null`. Ele é obrigatório e não nulo somente quando o status é `AGENDADA`. Em estados terminais, pode conter o horário histórico ou ser nulo para compatibilidade com dados anteriores.

### 8.5 Validação e erros

Validações de entrada:

- data obrigatória no formato exato `YYYY-MM-DD`;
- hora obrigatória no formato exato `HH:mm`;
- data e hora devem formar uma data local válida;
- o instante deve ser estritamente posterior ao instante atual;
- campos desconhecidos não são aceitos;
- não existe antecedência mínima;
- não existe validação de conflito por igualdade de horário.

Exemplos de erro:

```json
{
  "message": "Os dados do agendamento são inválidos.",
  "errors": {
    "data_agendada": ["Informe a data do atendimento."],
    "hora_agendada": ["Informe o horário do atendimento."]
  }
}
```

Casos e códigos:

| Caso | Código |
|---|---:|
| Campo ausente, formato inválido ou instante não futuro | 422 |
| `RECEBIDA → AGENDADA`, mesmo com data/hora válidas | 409 |
| Reagendar solicitação que não está `AGENDADA` | 409 |
| Solicitação inexistente | 404 |
| Mesmo horário usado por outra solicitação | 200 |

## 9. Backend

### 9.1 Agendamento inicial

`AtualizarStatusRequest` fará a validação estrutural e condicional. `AtualizarStatusSolicitacao` receberá o status de destino e, quando aplicável, o instante normalizado.

Dentro da mesma transação, a Action:

1. relê a solicitação com `lockForUpdate`;
2. valida a transição usando a tabela de estados existente;
3. verifica a presença do instante quando o destino é `AGENDADA`;
4. atualiza status e `agendado_para` atomicamente;
5. preserva `agendado_para` ao concluir ou cancelar uma solicitação que já foi agendada.

Ao sair de `RECEBIDA` ou `EM_ANALISE` por transições que não sejam para `AGENDADA`, o campo permanece nulo.

### 9.2 Reagendamento

A nova Action `ReagendarSolicitacao`:

1. inicia transação;
2. relê a linha com `lockForUpdate`;
3. exige status atual `AGENDADA`;
4. compara o novo instante ao existente;
5. retorna sem escrita se forem iguais;
6. atualiza apenas `agendado_para` se forem diferentes.

Ela nunca altera status e, portanto, não compete com `AtualizarStatusSolicitacao` como autoridade da máquina de estados.

### 9.3 Listagem

`ListarSolicitacoesRequest` passa a aceitar `data_agendada`. A consulta converte o dia local para limites UTC, filtra o intervalo e aplica a ordenação de agenda. Sem esse filtro, a ordenação atual da fila permanece inalterada.

## 10. Concorrência

### 10.1 Dois agendamentos iniciais simultâneos

O bloqueio pessimista serializa as operações. A primeira transição válida conclui `EM_ANALISE → AGENDADA`; a segunda relê o estado `AGENDADA` e recebe 409 por transição inválida.

### 10.2 Dois reagendamentos simultâneos

O bloqueio pessimista serializa as gravações. Nesta primeira versão, a última requisição válida processada vence. Controle otimista com versão não será introduzido porque ampliaria o contrato de todas as mutações sem necessidade demonstrada pelo desafio.

### 10.3 Horários coincidentes

Não existe consulta prévia de disponibilidade nem constraint única. Duas solicitações podem ser persistidas para o mesmo instante, inclusive em requisições concorrentes.

## 11. Frontend e experiência de uso

### 11.1 Navegação principal

A tela principal terá três visões:

- **Fila atual:** preserva o comportamento atual;
- **Agenda:** lista solicitações agendadas para uma data escolhida;
- **Histórico encerrado:** preserva o comportamento atual.

A visão de agenda usa a URL:

```text
/?visao=agenda&data=2026-09-25
```

Na ausência de `data`, a data inicial é o dia atual no fuso operacional. Valores inválidos na URL são substituídos pelo dia atual e a URL é normalizada.

### 11.2 Fluxo de agendamento

Na página de detalhes de uma solicitação `EM_ANALISE`, o botão genérico “Mover para Agendada” será substituído por “Agendar atendimento”. A ação abre um painel expansível no fluxo da página, não um modal.

O painel apresenta:

- protocolo, categoria e prioridade para confirmação de contexto;
- campo obrigatório “Data do atendimento”;
- campo obrigatório “Horário do atendimento”;
- texto auxiliar indicando o fuso operacional;
- botão primário “Confirmar agendamento”;
- botão secundário “Cancelar edição”.

Os campos iniciam vazios e nenhum valor é inferido. A validação ocorre ao sair do campo e ao enviar. Em falha de rede, os valores digitados são preservados.

### 11.3 Fluxo de reagendamento

Uma solicitação `AGENDADA` exibe data e hora formatadas e a ação “Alterar agendamento”. O painel é preenchido com o valor atual. “Concluir” e “Cancelar solicitação” continuam como ações independentes e não são incorporadas ao formulário.

Se o usuário não modificar os valores e confirmar, a interface aceita o sucesso idempotente. Se o status tiver mudado em outra sessão, a resposta 409 é apresentada e os dados da solicitação são recarregados.

### 11.4 Estados e acessibilidade

- Durante o envio, os campos e a ação principal ficam desabilitados e a região usa `aria-busy`.
- Erros aparecem junto aos respectivos campos.
- Quando houver múltiplos erros, um resumo focalizável aponta para os campos inválidos.
- Mensagens de sucesso usam uma região `aria-live` sem deslocar o layout abruptamente.
- Rótulos permanecem visíveis; placeholder não substitui label.
- O foco retorna para uma posição previsível ao cancelar a edição.
- Datas são exibidas conforme `pt-BR`, mantendo o valor técnico apenas na API e nos controles nativos.

### 11.5 Sistema visual

A implementação reutiliza os tokens, campos, botões, painéis, badges e estados já definidos em `frontend/src/index.css` e `docs/design-system.md`.

Não serão criadas cores específicas de agendamento. Novos tokens só serão adicionados se uma decisão visual for reutilizada por mais de um componente. O layout será validado nos breakpoints existentes e os controles manterão altura mínima de 44 px.

## 12. Casos de borda

| Cenário | Comportamento esperado |
|---|---|
| Data sem hora ou hora sem data | 422; ambos continuam obrigatórios |
| Data/hora iguais ao instante atual | 422; deve ser estritamente futuro |
| Hoje com horário futuro | permitido |
| Data impossível, como 31/02 | 422 |
| Horário impossível, como 24:30 | 422 |
| Horário com segundos na requisição | 422 |
| Mesmo instante de outra solicitação | permitido |
| Tentativa direta `RECEBIDA → AGENDADA` | 409 |
| Reagendar `EM_ANALISE`, `CONCLUIDA` ou `CANCELADA` | 409 |
| Remover data/hora de `AGENDADA` | 422 |
| Confirmar o mesmo horário atual | 200 idempotente |
| Cancelar uma solicitação agendada | mantém a data/hora como histórico |
| Concluir uma solicitação agendada | mantém a data/hora como histórico |
| Dia selecionado sem registros | estado vazio |
| Mudança de data com paginação ativa | volta à primeira página |
| Status muda durante edição | 409, mensagem contextual e recarga |
| Virada de meia-noite com tela aberta | data selecionada não muda sozinha |
| Fuso com transição sazonal | limites calculados pelo fuso; horário local inexistente ou ambíguo é rejeitado |

## 13. Estratégia de testes e TDD

A implementação seguirá ciclos RED → GREEN → REFACTOR, um comportamento por vez. Nenhum código de produção será escrito antes de um teste relevante falhar pela razão esperada.

Ordem dos ciclos:

1. testes PostgreSQL das constraints e da migração de registros existentes;
2. validação condicional da requisição de mudança de status;
3. caminho feliz `EM_ANALISE → AGENDADA` com escrita atômica;
4. rejeição da transição sem data/hora e das transições incompatíveis;
5. preservação do horário ao concluir ou cancelar;
6. reagendamento válido, inválido e idempotente;
7. concorrência no agendamento inicial e no reagendamento;
8. coexistência de solicitações no mesmo horário;
9. filtro diário com conversão de fuso, limites e ordenação;
10. serialização do novo campo e documentação OpenAPI;
11. testes de frontend do formulário, erros, sucesso e acessibilidade;
12. testes da visão diária, URL, paginação e estados assíncronos;
13. suítes completas de backend e frontend e build de produção.

Os relógios serão congelados nos testes. Os cenários de banco e concorrência usarão PostgreSQL 16. Testes de frontend mockarão o cliente HTTP e usarão consultas acessíveis por papel e rótulo.

## 14. Arquivos previstos para a implementação

### Backend

- migration para `agendado_para`, índice, saneamento legado e constraints;
- `app/Domain/Solicitacoes/Actions/AtualizarStatusSolicitacao.php`;
- nova `app/Domain/Solicitacoes/Actions/ReagendarSolicitacao.php`;
- requests de atualização de status, reagendamento e listagem;
- `SolicitacaoController.php`;
- `SolicitacaoResource.php`;
- `Solicitacao.php`;
- `routes/api.php`;
- factory e seeder;
- testes de feature, domínio, banco e concorrência;
- configuração e `.env.example` do fuso operacional.

### Frontend

- tipos e cliente da feature de solicitações;
- hooks de mutação e consulta;
- novo formulário de agendamento reutilizável;
- página de detalhes;
- página principal e visão diária;
- estilos que reutilizem o sistema visual existente;
- testes de componentes, integração e acessibilidade;
- configuração de ambiente do fuso operacional.

### Documentação

- `docs/spec.md` para o contrato interno;
- especificação OpenAPI;
- README e exemplos de ambiente;
- `docs/architecture.md` quando o fluxo integrado estiver estável;
- `docs/design-system.md` somente se surgir uma regra visual reutilizável.

## 15. Implantação e compatibilidade

A entrega não depende de feature flag. A migração torna impossível manter registros `AGENDADA` sem horário, por isso o backend e o banco devem ser implantados juntos. O frontend antigo continuará conseguindo alterar outros estados, mas não conseguirá agendar sem os novos campos; a janela de incompatibilidade deve ser evitada com implantação coordenada.

Após a migração:

- registros legados `AGENDADA` estarão em `EM_ANALISE` e precisarão ser agendados novamente com informação real;
- registros `CONCLUIDA` ou `CANCELADA` não serão reabertos nem receberão datas inventadas;
- consumidores da API devem aceitar o novo campo anulável `agendado_para`.

## 16. Fora de escopo

- check-in ou registro de chegada;
- fila física e chamada de senha;
- capacidade por horário;
- duração do atendimento;
- agenda por profissional, sala ou unidade;
- bloqueio de feriados e expediente;
- cálculo clínico de risco;
- cadastro de comorbidades;
- prioridade legal/preferencial automatizada;
- notificações e lembretes;
- recorrência;
- lista de espera automática;
- edição de data/hora em estados terminais;
- controle otimista por versão.

Esses itens podem evoluir em módulos próprios sem alterar a máquina de estados atual. Se futuramente houver recursos limitados, o conceito de conflito deve ser associado ao recurso e ao intervalo de atendimento, não apenas à igualdade de horário.

## 17. Critérios de aceite

A feature estará pronta quando:

- nenhuma solicitação puder ficar `AGENDADA` sem data e hora;
- somente `EM_ANALISE` puder transicionar para `AGENDADA`;
- o reagendamento modificar apenas uma solicitação `AGENDADA`;
- horários iguais forem aceitos para solicitações diferentes;
- datas passadas e formatos inválidos forem rejeitados;
- cancelamento e conclusão preservarem o horário histórico;
- a agenda diária respeitar fuso, intervalo, ordenação e paginação;
- a fila atual mantiver sua ordenação existente;
- a interface cobrir todos os estados assíncronos e requisitos de acessibilidade;
- constraints, concorrência, API, frontend e build estiverem verificados;
- documentação, tarefas e handoff refletirem o comportamento implementado.
