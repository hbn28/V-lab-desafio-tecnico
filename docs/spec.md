# Especificação técnica — Solicitações de Atendimento

Este arquivo é a fonte de verdade para dados, API e regras de negócio. Em caso de conflito com outros documentos do repositório, este arquivo prevalece. O edital oficial prevalece sobre todos os documentos internos.

## Escopo

O fluxo obrigatório é criar solicitação, listar/consultar, filtrar e atualizar status, com React + TypeScript consumindo exclusivamente a API Laravel e persistência em PostgreSQL. Autenticação não faz parte do núcleo obrigatório; foi implementada como bônus.

## Tipos do domínio

```typescript
export type Categoria = 'CONSULTA' | 'EXAME' | 'VACINACAO' | 'OUTRO';
export type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type Status = 'RECEBIDA' | 'EM_ANALISE' | 'AGENDADA' | 'CONCLUIDA' | 'CANCELADA';

export interface SolicitacaoListItem {
  id: number;
  protocolo: string;
  nome_solicitante: string;
  cpf_solicitante: string; // CPF mascarado em listagens e respostas de escrita
  categoria: Categoria;
  prioridade: Prioridade;
  status: Status;
  agendado_para: string | null;
  descricao: string;
  justificativa_prioridade: string | null;
  data_criacao: string;
  data_atualizacao: string;
}

export interface Solicitacao extends SolicitacaoListItem {
  cpf_solicitante: string; // CPF completo só no detalhe GET /solicitacoes/{id}
  data_nascimento: string; // Campo exclusivo do detalhe
}
```

Datas são retornadas em UTC, no formato ISO 8601. No banco, os campos são `created_at` e `updated_at`; apenas o Resource os expõe como `data_criacao` e `data_atualizacao`. Listagens, fila contínua e respostas de escrita omitem `data_nascimento` e mascaram o CPF; o CPF completo e a data de nascimento só aparecem no detalhe `GET /solicitacoes/{id}`.

## Máquina de estados

```text
RECEBIDA   -> EM_ANALISE | CANCELADA
EM_ANALISE -> AGENDADA   | CANCELADA
AGENDADA   -> CONCLUIDA  | CANCELADA
CONCLUIDA  -> nenhum
CANCELADA  -> nenhum
```

- Toda criação nasce como `RECEBIDA`; `status` enviado no POST é rejeitado.
- A Action `AtualizarStatusSolicitacao` é a única fonte de verdade das transições.
- Repetir o status atual, pular etapas ou sair de estado final retorna 409.
- A Action executa em `DB::transaction`, recarrega a solicitação com `lockForUpdate`, valida o estado obtido sob o lock e só então atualiza.
- O frontend pode esconder opções impossíveis por usabilidade, mas sua tabela não é autoridade de negócio.

## Agenda de solicitações

A agenda é informação complementar do estado `AGENDADA`, não uma nova etapa: nenhum estado ou transição foi adicionado.

### Campo `agendado_para`

`agendado_para` é `TIMESTAMP WITH TIME ZONE` nulo, persistido e retornado em UTC (ISO 8601), com índice simples. Ele é preenchido para a modalidade `HORARIO` e fica nulo para `TURNO`. A tabela `agendamentos` guarda a data e o turno de ambas as modalidades. Os dois CHECKs antigos que exigiam `agendado_para` em `AGENDADA` e o proibiam em estados iniciais foram removidos pela migration `2026_09_22_000006_migrate_agenda_and_replace_legacy_checks.php`. A Action de status, as FormRequests e o índice único parcial de agendamento ativo protegem o fluxo atual.

- `AGENDADA` exige um agendamento por horário ou por turno; `agendado_para` pode ser nulo quando o agendamento é por turno.
- `CONCLUIDA` e `CANCELADA` preservam `agendado_para` quando houve agendamento por horário; ele pode ser nulo se o atendimento foi por turno, se houve cancelamento antes de agendar ou em dados legados.
- Não existe restrição de unicidade para a data ou o horário: **horários iguais para solicitações diferentes são permitidos**, e igualdade de horário não é conflito. Existe apenas índice simples em `agendado_para` e índice único parcial para impedir dois agendamentos ativos da mesma solicitação. Capacidade, vaga, duração, sala e profissional estão fora de escopo.
- A agenda **não registra chegada ao local** (check-in); a ordem real de chegada permanece fora do sistema, e não há priorização clínica automática.
- A migration converte registros legados `AGENDADA` em `EM_ANALISE` (sem inventar horário) antes de instalar as constraints; backend e banco devem ser implantados juntos.

### Fuso operacional

O Laravel permanece em UTC. A data/hora digitada é interpretada em `AGENDAMENTO_TIMEZONE` (padrão `America/Recife`; espelhada no frontend por `VITE_AGENDAMENTO_TIMEZONE`). Horário local inexistente ou ambíguo por mudança de offset é rejeitado com 422, sem normalização silenciosa. O instante deve ser estritamente futuro; segundos não são aceitos.

### Agendamento inicial

`PATCH /api/v1/solicitacoes/{id}/status` continua sendo a única via para entrar em `AGENDADA` (`EM_ANALISE → AGENDADA`, em `AtualizarStatusSolicitacao`):

```json
{ "status": "AGENDADA", "data_agendada": "2026-09-25", "hora_agendada": "14:30" }
```

- para `AGENDADA`, `data_agendada` (`YYYY-MM-DD`) e exatamente um entre `hora_agendada` (`HH:mm`) e `turno` (`MANHA`, `TARDE`, `NOITE`) são obrigatórios;
- para qualquer outro destino, esses campos são proibidos (422);
- campos desconhecidos retornam 422;
- `RECEBIDA → AGENDADA` continua 409, mesmo com payload completo.

### PATCH `/api/v1/solicitacoes/{id}/agendamento`

Reagendamento: atualiza o agendamento ativo e `agendado_para` (nulo para turno) de uma solicitação já `AGENDADA`, na Action `ReagendarSolicitacao` (transação + `lockForUpdate`), que nunca altera `status`.

```json
{ "data_agendada": "2026-09-28", "hora_agendada": "09:00" }
```

Resposta 200: `{ "data": Solicitacao }`. Reenviar a mesma data/modalidade/horário ou turno é idempotente (200, sem escrita, `updated_at` inalterado). Solicitação fora de `AGENDADA` retorna 409; payload inválido, no passado ou com campo desconhecido retorna 422; inexistente retorna 404. Não é possível remover o agendamento ativo por essa rota. Em reagendamentos concorrentes, o último válido processado vence (sem controle otimista por versão).

## Endpoints

### POST `/api/v1/solicitacoes`

Request:

```json
{
  "nome_solicitante": "Maria Silva",
  "cpf_solicitante": "123.456.789-00",
  "data_nascimento": "1985-06-15",
  "categoria": "CONSULTA",
  "prioridade": "ALTA",
  "descricao": "Consulta de rotina em cardiologia",
  "justificativa_prioridade": null
}
```

Resposta 201: `{ "data": Solicitacao }`.

| Campo | Regra |
| --- | --- |
| `nome_solicitante` | required, string, max:255 |
| `cpf_solicitante` | required, string no formato `000.000.000-00`, max:14; usar apenas valor fictício |
| `data_nascimento` | required, data `YYYY-MM-DD`, posterior a `1900-01-01` e anterior ao dia atual |
| `categoria` | required, enum `Categoria` |
| `prioridade` | required, enum `Prioridade` |
| `descricao` | required, string, max:2000 |
| `justificativa_prioridade` | nullable; required e não vazia após trim quando `URGENTE`; string; max:1000 |

`id`, `protocolo`, `status`, timestamps e demais campos desconhecidos não são dados graváveis.

### GET `/api/v1/solicitacoes`

Query: `q`, `status`, `status_grupo`, `categoria`, `prioridade`, `data_agendada`, `data_de`, `data_ate`, `ordenar_por`, `direcao`, `page`, `per_page`.

- filtros vazios são tratados como ausentes;
- enums desconhecidos retornam 422;
- `page` deve ser inteiro >= 1;
- `per_page` deve ser inteiro entre 1 e 100, padrão 15;
- `q` busca por protocolo ou nome do solicitante (máximo 100 caracteres; curingas são tratados como texto);
- `data_de` e `data_ate` filtram o período inclusivo no fuso operacional. Na fila usam a criação, em agendadas o compromisso e no histórico a atualização/encerramento;
- `ordenar_por` aceita `prioridade`, `data` ou `horario`; `direcao` aceita `asc` ou `desc` para data/horário. A prioridade continua da mais urgente para a mais baixa;
- data/horário e prioridade têm desempates determinísticos; ordenação incompatível com o conjunto (por exemplo, `horario` sem agendamentos) retorna 422;
- `status_grupo=aberto` retorna apenas `RECEBIDA`, `EM_ANALISE` e `AGENDADA`; a ordenação é `URGENTE`, `ALTA`, `MEDIA`, `BAIXA`, depois `created_at ASC` (mais antiga primeiro), com `id ASC` como desempate.
- `status_grupo=encerrado` retorna apenas `CONCLUIDA` e `CANCELADA`, por `updated_at DESC` (encerramento mais recente primeiro), com `id DESC` como desempate.
- sem `status_grupo`, a listagem preserva a ordenação legada: abertas primeiro, depois encerradas.
- `data_agendada=YYYY-MM-DD` seleciona a agenda de um dia operacional: restringe a `AGENDADA` com horário exato dentro do intervalo UTC semiaberto do dia local **ou** agendamento ativo por turno com a data pedida. Horários exatos vêm primeiro; depois os turnos na ordem manhã, tarde e noite, com prioridade e identificadores como desempates. Combinar com `status` diferente de `AGENDADA` ou com `status_grupo=encerrado` retorna 422; `status_grupo=aberto` é aceito. Paginação preservada.
- `status=AGENDADA` sem `data_agendada` ordena pela data operacional do compromisso; horários exatos vêm antes dos turnos, com desempates determinísticos (ADR 003, `docs/decisions/003-separar-fila-de-triagem-e-agenda.md`). Qualquer outro valor de `status` mantém a ordenação da fila operacional.

Solicitações `CONCLUIDA` e `CANCELADA` permanecem disponíveis na listagem, mas ficam depois dos estados ativos. A ordenação é aplicada no backend para permanecer consistente entre páginas e consumidores da API.

Resposta 200:

```json
{
  "data": [],
  "meta": { "total": 0, "per_page": 15, "current_page": 1, "last_page": 1 },
  "links": { "first": "...", "last": "...", "next": null, "prev": null }
}
```

### GET `/api/v1/solicitacoes/{id}`

Resposta 200: `{ "data": Solicitacao }`. Identificador inexistente retorna 404 no envelope comum.

### PATCH `/api/v1/solicitacoes/{id}/status`

Campos aceitos: `status` (obrigatório, pertencente a `Status`) e, somente quando `status` é `AGENDADA`, `data_agendada` e exatamente um entre `hora_agendada` e `turno` (ver "Agenda de solicitações"). Resposta 200: `{ "data": Solicitacao }`. Transição não permitida retorna 409.

## Extensão além do edital — editar e apagar

> **Atenção:** esta seção documenta uma extensão pedida explicitamente pelo candidato, fora do fluxo obrigatório descrito em "Escopo" (criar, listar/consultar, filtrar, atualizar status). O edital oficial (`Seleção V-LAB - Desafio Técnico Full Stack`, seção 2.2 a 2.5) não menciona editar nem apagar em nenhum requisito obrigatório, pontuável ou bônus — apenas define o fluxo mínimo e a máquina de estados de status. O edital também permite explicitamente estender as rotas sugeridas: "Alterações são permitidas desde que sejam consistentes, documentadas e preservem as funcionalidades solicitadas" (seção 2.3-C). Os dois endpoints abaixo seguem essa permissão e estão documentados aqui e no `docs/openapi.yaml`; não fazem parte do contrato mínimo avaliado.

### PUT `/api/v1/solicitacoes/{id}`

Substitui os dados cadastrais da solicitação (mesmas regras de validação do POST). `id`, `protocolo` e `status` continuam não graváveis. Resposta 200: `{ "data": Solicitacao }`.

Bloqueado (409) quando a solicitação está em estado final (`CONCLUIDA` ou `CANCELADA`) — dados de um atendimento encerrado não são mais editáveis. O vínculo com paciente segue o CPF normalizado: trocar o CPF associa outro paciente (existente ou novo); divergência de nascimento de um cadastro compartilhado retorna 422. Se o paciente só tem esta solicitação, a edição pode corrigir sua data de nascimento. `celular` opcional atualiza o cadastro do paciente quando informado. O CPF segue mascarado na resposta; os dados pessoais completos ficam apenas no GET de detalhe.

### DELETE `/api/v1/solicitacoes/{id}`

Remove definitivamente a solicitação (hard delete). Permitido em qualquer estado. Resposta 204 sem corpo. Identificador inexistente retorna 404 no envelope comum.

## Pacientes, fila contínua, agenda por turno e faltas

> Extensão sobre o fluxo mínimo do edital (mesma permissão de "Alterações são permitidas desde que sejam consistentes, documentadas e preservem as funcionalidades solicitadas", seção 2.3-C). Não remove nem altera o contrato mínimo de `solicitacoes` descrito acima; `solicitacoes.status` continua a máquina de estados oficial e **nunca** armazena `FALTA`.

### Paciente (`pacientes`)

Cada solicitação passa a referenciar um `Paciente`, reaproveitado por CPF normalizado (`cpf_solicitante` sem máscara). Ao criar uma solicitação:

- se já existe um paciente com o mesmo CPF e a mesma `data_nascimento`, ele é reaproveitado (`paciente_id` aponta para o registro existente);
- se existe um paciente com o mesmo CPF e `data_nascimento` diferente, a criação retorna 422 em `cpf_solicitante` ("CPF já cadastrado com outra data de nascimento.");
- caso contrário, um novo `Paciente` é criado.

`celular` é opcional na criação (`CriarSolicitacaoRequest`) e fica em `pacientes.celular`. A API nunca devolve o número completo: `SolicitacaoResource` e os demais Resources expõem `paciente.celular_mascarado` (formato `(DD) *****-NNNN`, últimos 4 dígitos visíveis), via `MascararContato::celular()`.

### Fila contínua (`entradas_fila`)

A fila de espera passou a ser um registro próprio, independente da paginação/ordenação de `GET /solicitacoes`:

- `EM_ANALISE` abre uma `EntradaFila` (`entrou_em = now()`), via efeito colateral em `AtualizarStatusSolicitacao`;
- `AGENDADA` ou `CANCELADA` encerram a entrada aberta (`encerrada_em`, `motivo_encerramento` = `AGENDAMENTO` ou `CANCELAMENTO`);
- há no máximo uma `EntradaFila` aberta por solicitação, garantido por índice único parcial (`WHERE encerrada_em IS NULL`).

### Agendamento por horário ou por turno (`agendamentos`)

`solicitacoes.agendado_para` é mantido **somente** para compatibilidade com agendamentos por horário exato (modalidade `HORARIO`); para modalidade `TURNO` ele permanece `null`. A fonte de verdade do agendamento passou a ser a tabela `agendamentos`:

- `modalidade`: `HORARIO` ou `TURNO` (CHECK);
- `data_agendada`: data local (fuso `AGENDAMENTO_TIMEZONE`);
- `hora_agendada`: exclusiva de `HORARIO` — presente só nessa modalidade (CHECK `chk_modalidade_hora` garante `hora_agendada IS NOT NULL` só quando `modalidade = 'HORARIO'` e `IS NULL` quando `modalidade = 'TURNO'`);
- `turno` (`MANHA`, `TARDE` ou `NOITE`): **sempre presente, nas duas modalidades** — não é exclusivo de `TURNO`. Ao agendar só por horário exato, o turno correspondente é **derivado e persistido automaticamente** (`TurnoAgendamento::derivarDaHora`, chamada dentro de `AtualizarStatusRequest`/`ReagendarSolicitacaoRequest` antes de a Action criar o `Agendamento`). O CHECK (`chk_modalidade_hora`) exige `turno IS NOT NULL` em ambas as modalidades — só `hora_agendada` é exclusiva de `HORARIO`;
- `status`: `AGENDADO`, `REALIZADO`, `FALTA` ou `CANCELADO` (CHECK). **Este é o único lugar do sistema onde `FALTA` existe** — `solicitacoes.status` nunca assume esse valor;
- no máximo um `Agendamento` com `status = AGENDADO` por solicitação, garantido por índice único parcial.

Derivação de turno a partir de horário exato (`TurnoAgendamento::derivarDaHora`, espelhada no frontend por `derivarTurnoDaHora`, usada só para o texto ao vivo "Turno: Manhã" no formulário — quem persiste o valor é sempre o backend): `06:00–11:59 → MANHA`, `12:00–17:59 → TARDE`, `18:00–05:59 (dia seguinte) → NOITE`. Como todo `Agendamento` sempre tem `turno` preenchido (derivado ou explícito), a agenda e o painel de faltas podem agrupar/filtrar por turno independentemente da modalidade escolhida na hora de marcar.

### Agenda do dia inclui HORARIO e TURNO

`GET /solicitacoes?data_agendada=` (usada pela visão "Agenda" do painel) casa dois critérios, unidos por OR, para o dia operacional pedido:

1. `agendado_para` dentro do intervalo UTC semiaberto do dia (cobre `modalidade = HORARIO`, que é o único caso em que `agendado_para` é preenchido); ou
2. existe um `Agendamento` ativo (`status = AGENDADO`) com `modalidade = TURNO` e `data_agendada` igual ao dia pedido.

Sem o segundo critério, uma solicitação agendada só por turno nunca apareceria nessa tela — `agendado_para` é sempre `null` para `TURNO`, e a query original filtrava exclusivamente por esse campo. Dentro do dia, os itens por horário exato vêm primeiro (ordenados por `agendado_para`); os itens por turno vêm depois, ordenados por `MANHA` → `TARDE` → `NOITE` e, dentro do mesmo turno, por prioridade. Na tabela, a coluna que mostraria o horário mostra o nome do turno (`Manhã`/`Tarde`/`Noite`) quando não há horário exato.

`PATCH /solicitacoes/{id}/status` (transição para `AGENDADA`) e `PATCH /solicitacoes/{id}/agendamento` (reagendar) aceitam **exatamente um** dos dois formatos, nunca ambos nem nenhum:

```json
{ "data_agendada": "2026-09-25", "hora_agendada": "14:30" }
```

```json
{ "data_agendada": "2026-09-25", "turno": "TARDE" }
```

Payload ambíguo (os dois presentes) ou incompleto (nenhum presente) retorna 422.

### Faltas e tentativas de contato

Uma falta é um **estado do agendamento**, não da solicitação:

- `POST /api/v1/agendamentos/{id}/falta` marca o `Agendamento` ativo (`status = AGENDADO`) como `FALTA` (`falta_registrada_em = now()`). Só é aceito depois do horário marcado (modalidade `HORARIO`) ou do fim do turno (modalidade `TURNO`, via `TurnoAgendamento::fimDoTurnoUtc`); antes disso retorna 422. `solicitacoes.status` permanece `AGENDADA`.
- `POST /api/v1/agendamentos/{id}/tentativas-contato` registra uma tentativa de contato (`TentativaContato`) para um agendamento em `FALTA`. O payload é enxuto — **apenas** o resultado fechado, sem campo de texto livre:

  ```json
  { "resultado": "SEM_RESPOSTA" }
  ```

  `resultado` é um de `SEM_RESPOSTA`, `RECADO`, `CONFIRMOU_RETORNO`, `NUMERO_INVALIDO` (CHECK). Agendamento fora de `FALTA` retorna 409.
- `POST /api/v1/agendamentos/{id}/reagendar-apos-falta` cria um **novo** `Agendamento` (`status = AGENDADO`) para a mesma solicitação, com o mesmo payload de horário/turno de "Agendamento por horário ou por turno" acima, **preservando** a linha `FALTA` original como histórico. Exige que a solicitação esteja `AGENDADA` e que não exista outro `Agendamento` já `AGENDADO` ou posterior à falta escolhida. Ao reagendar, preenche `resultado_em` na falta original para indicar que ela foi resolvida; uma repetição da mesma ação retorna 409. A falta permanece visível no histórico, marcada como reagendada, sem oferecer outro reagendamento.
- Concluir (`CONCLUIDA`) uma solicitação cujo agendamento ativo está em `FALTA` corrige o registro: marca `REALIZADO` e preenche `falta_corrigida_em`, sem apagar `falta_registrada_em` — o histórico da ausência original não é perdido.
- Cancelar (`CANCELADA`) uma solicitação com agendamento `AGENDADO` marca esse agendamento como `CANCELADO`.

### Novos endpoints de leitura

- `GET /api/v1/fila`: fila operacional contínua (uma linha por `EntradaFila` aberta, join com `solicitacoes`), ordenada por prioridade (`URGENTE`, `ALTA`, `MEDIA`, `BAIXA`) e, no empate, por `entrou_em ASC`.
- `GET /api/v1/faltas`: lista agendamentos em `FALTA`, com paciente (nome, telefone mascarado), protocolo, data/horário ou turno original, `resultado_em`, última tentativa de contato (`ultima_tentativa_contato`, se houver) e, quando existir, o agendamento ativo da solicitação (`solicitacao.agendamento_ativo`). Essa relação permite distinguir uma falta histórica já reagendada de uma falta ainda disponível para reagendamento.
  Aceita `q`, `prioridade`, `data_de`, `data_ate`, `resultado_contato`, `ordenar_por`, `direcao`, `page` e `per_page`, com a mesma busca por protocolo/nome e ordenação validada no servidor.

## Contrato de erros

Toda resposta JSON de erro usa:

```json
{ "message": "Descrição legível.", "errors": {} }
```

`errors` está sempre presente. Erros por campo usam arrays de strings.

| Código | Uso |
| --- | --- |
| 404 | rota ou solicitação inexistente |
| 405 | método HTTP não permitido |
| 409 | transição incompatível com o status atual, ou reagendamento de solicitação que não está `AGENDADA` |
| 422 | body, parâmetro, enum ou regra de entrada inválida |
| 429 | limite de requisições excedido |
| 500 | falha interna genérica, sem detalhes internos |

A autenticação implementada como bônus usa o mesmo envelope de erro para 401 e 403. O login aceita usuário (campo `login`) e senha; e-mail de contas antigas também pode ser informado em `login`. Contas novas têm usuário único e e-mail opcional. O cadastro público opcional usa `GET /api/v1/auth/cadastro` para informar se está habilitado e `POST /api/v1/auth/cadastro` para criar uma conta, com limitação de 5 tentativas por minuto. A conta sempre nasce ativa com perfil `ATENDENTE`; `role` e `is_active` enviados pelo cliente não alteram isso. `CADASTRO_PUBLICO=false` desativa o cadastro e mantém `operadores:criar` para criação administrativa. Recuperação de senha por e-mail não está implementada.

## Modelo e migrations iniciais

Criar `solicitacoes` e `protocolo_counters` antes dos endpoints.

### `solicitacoes`

- `id`: bigint, PK;
- `protocolo`: string, unique;
- `nome_solicitante`: string;
- `cpf_solicitante`: string de 14 caracteres;
- `data_nascimento`: date;
- `categoria`, `prioridade`, `status`: string com CHECK;
- `descricao`: text;
- `justificativa_prioridade`: text nullable;
- `agendado_para`: timestamptz nullable, com índice (migration `2026_09_21_000003`);
- timestamps;
- índices individuais em `status`, `categoria` e `prioridade`;
- CHECK: prioridade diferente de `URGENTE` ou justificativa não nula e não vazia após `btrim`;
- Os CHECKs legados `chk_agendada_com_horario` e `chk_estado_inicial_sem_horario` foram removidos para aceitar agendamentos por turno; a tabela `agendamentos` tem CHECKs próprios e índice único parcial para o registro ativo.

### `protocolo_counters`

- `ano`: integer, PK;
- `ultimo_numero`: integer, default 0, CHECK >= 0.

## Geração de protocolo

Formato: `SOL-AAAA-NNNN`. A largura mínima é quatro dígitos; números acima de 9999 não são truncados.

A geração pertence exclusivamente à Action `CriarSolicitacao`, na mesma transação que cria a solicitação. Não usar evento `creating` nem `count() + 1`.

1. Obter o ano com relógio da aplicação em UTC.
2. Executar `INSERT ... ON CONFLICT DO NOTHING` para garantir a linha do ano.
3. Buscar a linha com `lockForUpdate`.
4. Incrementar e persistir `ultimo_numero`.
5. Formatar o protocolo e inserir a solicitação.
6. Confirmar tudo na mesma transação.

O índice único em `protocolo` permanece como defesa final.

A carga operacional fictícia `solicitacoes:popular-demonstracao`, quando explicitamente acionada, é exceção restrita aos 500 registros de demonstração: seus `id` e `protocolo` são valores únicos aleatórios de oito dígitos. O endpoint normal de criação continua usando a Action e o formato sequencial acima; a carga não altera `protocolo_counters`.

## Separação de responsabilidades

- Form Requests validam e normalizam criação, filtros e PATCH.
- Controllers orquestram Request -> Action -> Resource.
- Actions contêm regras e transações.
- `SolicitacaoResource` é o contrato de saída.
- O Model representa persistência e casts; não decide transições nem gera protocolo.
- No Laravel 11, exceções são configuradas em `bootstrap/app.php` com `withExceptions`.

Não criar DTO, Repository, CQRS, Event Sourcing ou histórico de status sem requisito novo.

## Frontend

```text
/                         resumo + listagem paginada + filtros (visões: fila, agenda, histórico)
/?visao=agenda&data=YYYY-MM-DD   agenda do dia (data inválida ou ausente vira o dia atual no fuso operacional)
/solicitacoes/nova        criação
/solicitacoes/:id         detalhe + atualização de status + agendar/reagendar
```

O destaque da fila chama-se "Próxima solicitação por prioridade". Na visão de agenda, o dia selecionado é fixado na montagem e não muda sozinho na virada da meia-noite; trocar o dia volta à página 1.

Nesse cartão e no drill-down de prioridade, o texto evita duplicar a mesma informação e evita sugerir espera/atraso quando não é o caso:

- Drill-down por prioridade (`abrirPorPrioridade`): uma única frase grande no cabeçalho (ex.: "4 solicitações urgentes em aberto"); não há mais uma frase pequena repetindo a mesma contagem em cima do título.
- "Próxima solicitação por prioridade": mostra "esperando há N dias" (a partir de `data_criacao`) só enquanto a solicitação ainda não tem agendamento ativo. Com agendamento ativo, mostra a data/turno real — "agendado para 23/09/2026 08:00" (modalidade `HORARIO`, a partir de `agendado_para`) ou "agendado para 25/09/2026 · turno da tarde" (modalidade `TURNO`, a partir de `data_agendada`/`turno`) — e só acrescenta "em atraso" quando esse horário (ou o dia do turno) já passou de fato.

Na visão "Fila atual", filtrar por `status=AGENDADA` reaproveita `data_agendada` como filtro de dia opcional (ADR 003) e mostra o horário marcado na coluna de data de qualquer linha que já tenha `agendado_para`, dentro ou fora da aba Agenda.

A tela inicial apresenta resumo por status ou prioridade. Toda consulta trata carregando, sucesso, vazio e erro. O cliente HTTP é tipado e centraliza o envelope de erro.

Usar tokens primitivos e semânticos mínimos; tokens específicos por componente somente quando houver reutilização real.

## Docker e configuração

O Compose terá `frontend`, `backend` e `db`.

- O backend usa servidor HTTP explícito (`php artisan serve --host=0.0.0.0`); não declarar PHP-FPM sem Nginx.
- O banco tem healthcheck e o backend aguarda estado saudável.
- `.env.example` contém placeholders; `.env` não é versionado.
- `APP_KEY` é gerada uma vez na preparação documentada e permanece estável; não é gravada na imagem.
- Seeders automáticos essenciais são idempotentes; massa demonstrativa não duplica a cada boot.
- CORS é restrito à origem configurável do frontend.

## Testes

Usar PostgreSQL nos testes que exercitam constraints, transações ou locks.

- criação válida e status inicial;
- URGENTE sem justificativa útil retorna 422;
- transição permitida;
- repetição, salto e estado final retornam 409;
- concorrência de status lê o estado atualizado;
- primeira geração concorrente do ano não falha nem duplica protocolo;
- filtros/paginação inválidos retornam 422;
- frontend exibe erro 422 com cliente HTTP mockado;
- constraints de agenda, agendamento inicial, reagendamento, filtro diário, conversão de fuso e relock de instância obsoleta.

---

## Bônus — Health Check

### GET `/api/v1/health`

Não requer autenticação. Verifica se a aplicação e o banco estão acessíveis.

Resposta 200 (tudo ok):

```json
{ "status": "ok", "db": "ok" }
```

Resposta 503 (banco inacessível):

```json
{ "status": "degraded", "db": "error" }
```

Implementação:

```php
// app/Domain/Health/HealthController.php
use Illuminate\Support\Facades\DB;

public function __invoke(): JsonResponse
{
    try {
        DB::select('SELECT 1');
        $db = 'ok';
        $code = 200;
    } catch (\Throwable) {
        $db = 'error';
        $code = 503;
    }
    return response()->json(['status' => $code === 200 ? 'ok' : 'degraded', 'db' => $db], $code);
}
```

Rota: `GET /api/v1/health` (sem prefixo de autenticação, sem throttle de avaliação).

---

## Bônus — Middleware RequestId e Logs Estruturados

### Middleware `App\Http\Middleware\RequestId`

Funciona em toda rota da API. Ordem de prioridade do ID:

1. Usa o valor de `X-Request-ID` do request de entrada, se presente e válido (UUID v4).
2. Gera `Str::uuid()` se ausente ou inválido.

Adiciona o ID a:
- `request` attributes: `request->attributes->set('request_id', $id)`
- resposta: header `X-Request-ID: <id>`
- contexto de log Laravel: `Log::withContext(['request_id' => $id])`

### Formato de log (canal `stack`, driver `daily`)

Usar `Monolog\Formatter\JsonFormatter`. Cada requisição à API emite uma linha ao final:

```json
{
  "level": "INFO",
  "message": "api_request",
  "context": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "method": "POST",
    "path": "/api/v1/solicitacoes",
    "status": 201,
    "duration_ms": 47
  },
  "datetime": "2025-01-01T00:00:00+00:00"
}
```

Implementar via `terminate()` do middleware com `microtime(true)` no `handle()`.

### Configuração em `bootstrap/app.php`

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->appendToGroup('api', [
        \App\Http\Middleware\RequestId::class,
    ]);
})
```

---

## Bônus — Seeders Idempotentes

### Estratégia

- `DatabaseSeeder` chama `SolicitacoesSeeder`.
- `SolicitacoesSeeder` usa `Solicitacao::firstOrCreate(['protocolo' => ...])` para não duplicar dados a cada `db:seed`.
- O Docker Compose entrypoint do backend executa `php artisan db:seed` somente quando `APP_SEED=true` (default no `.env.example`: `APP_SEED=false`; default no `docker-compose.yml` para avaliação: `APP_SEED=true`).
- Mínimo 10 solicitações cobrindo combinações representativas: pelo menos 1 URGENTE com justificativa, pelo menos 1 CONCLUIDA, 1 CANCELADA, demais em estados intermediários.
- `SolicitacaoFactory` gera dados com `Faker` em pt_BR; `justificativa_prioridade` é preenchida quando `prioridade = URGENTE`.

### Entrypoint do backend (`docker/backend/entrypoint.sh`)

```bash
#!/bin/sh
set -e
php artisan migrate --force
if [ "${APP_SEED:-false}" = "true" ]; then
  php artisan db:seed --force
fi
php artisan serve --host=0.0.0.0 --port=8000
```

---

## Bônus — CI (`.github/workflows/ci.yml`)

### Jobs

| Job | Runner | O que faz |
|---|---|---|
| `lint-backend` | ubuntu-latest | `./vendor/bin/pint --test` |
| `lint-frontend` | ubuntu-latest | `npm run lint` |
| `test-backend` | ubuntu-latest + postgres:16 | `./vendor/bin/pest --ci` com `DB_CONNECTION=pgsql` |
| `test-frontend` | ubuntu-latest | `npm run test -- --run` |
| `build-frontend` | ubuntu-latest | `npm run build` |

### Serviço PostgreSQL no job de testes

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_DB: vlab_test
      POSTGRES_USER: vlab
      POSTGRES_PASSWORD: secret
    ports: ["5432:5432"]
    options: >-
      --health-cmd pg_isready
      --health-interval 5s
      --health-timeout 5s
      --health-retries 5
```

Os testes do backend usam `DB_CONNECTION=pgsql`, `DB_DATABASE=vlab_test` etc. via variáveis de ambiente do job.

---

## Bônus — `docs/architecture.md`

Ver o arquivo `docs/architecture.md` para diagrama e decisões. O arquivo segue a estrutura abaixo e deve ser preenchido ao final, após o fluxo integrado estar estável.
