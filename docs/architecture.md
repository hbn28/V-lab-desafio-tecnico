# Arquitetura — V-Lab Solicitações

## Visão Geral

```
┌─────────────┐   HTTP/JSON   ┌──────────────────────────┐   pg_pdo   ┌──────────────┐
│  React SPA  │ ───────────► │   Laravel 11 API (PHP 8.3) │ ─────────► │ PostgreSQL 16│
│  (Vite/TS)  │ ◄─────────── │   porta 8000               │ ◄───────── │  porta 5432  │
└─────────────┘               └──────────────────────────┘            └──────────────┘
   porta 5173                         │
                              RequestId Middleware
                              (X-Request-ID header)
                              Logs JSON → stderr
```

## Fluxo de uma requisição

```mermaid
sequenceDiagram
    participant C as Client (React)
    participant M as RequestId Middleware
    participant FR as FormRequest
    participant A as Action
    participant DB as PostgreSQL

    C->>M: POST /api/v1/solicitacoes
    M->>M: Gera / propaga UUID X-Request-ID
    M->>FR: CriarSolicitacaoRequest::authorize + rules
    FR-->>C: 422 {message, errors} se inválido
    FR->>A: CriarSolicitacao::execute(validated)
    A->>DB: BEGIN TRANSACTION
    A->>DB: INSERT INTO protocolo_counters ON CONFLICT... FOR UPDATE
    A->>DB: INSERT INTO solicitacoes
    A->>DB: COMMIT
    A-->>FR: Solicitacao
    FR-->>M: 201 SolicitacaoResource
    M->>M: Anexa X-Request-ID na resposta
    M-->>C: 201 {data: {...}} + X-Request-ID header
```

## Diagrama de Status

```mermaid
stateDiagram-v2
    [*] --> RECEBIDA: POST /solicitacoes
    RECEBIDA --> EM_ANALISE: PATCH status
    RECEBIDA --> CANCELADA: PATCH status
    EM_ANALISE --> AGENDADA: PATCH status
    EM_ANALISE --> CANCELADA: PATCH status
    AGENDADA --> CONCLUIDA: PATCH status
    AGENDADA --> CANCELADA: PATCH status
    CONCLUIDA --> [*]
    CANCELADA --> [*]
```

## Fluxo de agendamento

O agendamento é um dado complementar de `AGENDADA`, não um estado novo. O agendamento inicial continua sendo a transição `EM_ANALISE → AGENDADA` em `AtualizarStatusSolicitacao`; o reagendamento é uma Action separada que só altera `agendado_para`.

```mermaid
sequenceDiagram
    participant F as AgendamentoForm (React)
    participant R as FormRequest
    participant H as HorarioAgendamento
    participant A as Action
    participant DB as PostgreSQL

    F->>R: PATCH /solicitacoes/{id}/status {AGENDADA, data_agendada, hora_agendada}
    F->>R: PATCH /solicitacoes/{id}/agendamento {data_agendada, hora_agendada}
    R->>H: interpretarLocal(data, hora, AGENDAMENTO_TIMEZONE)
    H-->>R: instante UTC (ou 422 se inexistente/ambíguo/passado)
    R->>A: AtualizarStatusSolicitacao / ReagendarSolicitacao
    A->>DB: BEGIN + SELECT ... FOR UPDATE
    A->>DB: UPDATE agendado_para (CHECK garante AGENDADA ⇒ horário)
    A-->>F: 200 SolicitacaoResource (agendado_para em UTC)
```

A consulta diária (`GET /solicitacoes?data_agendada=`) usa `HorarioAgendamento::limitesUtcDoDia` para o intervalo semiaberto `[início do dia local, início do seguinte)` e ordena por horário, prioridade, protocolo e id. Horários iguais são permitidos: não há capacidade, conflito de vaga nem check-in.

## Estrutura de Pastas (Backend)

```
backend/
├── app/
│   ├── Domain/
│   │   ├── Health/
│   │   │   └── HealthController.php
│   │   └── Solicitacoes/
│   │       ├── Actions/
│   │       │   ├── CriarSolicitacao.php       # lógica de negócio + protocolo
│   │       │   ├── AtualizarSolicitacao.php   # edição de dados abertos
│   │       │   ├── AtualizarStatusSolicitacao.php  # máquina de estados + agendamento inicial
│   │       │   ├── ReagendarSolicitacao.php   # só altera agendado_para de AGENDADA
│   │       │   └── ApagarSolicitacao.php      # extensão documentada
│   │       ├── Support/
│   │       │   └── HorarioAgendamento.php     # data/hora local <-> UTC, sem normalização silenciosa
│   │       └── Http/
│   │           ├── Controllers/
│   │           │   └── SolicitacaoController.php  # thin controller
│   │           ├── Requests/
│   │           │   ├── CriarSolicitacaoRequest.php
│   │           │   ├── ListarSolicitacoesRequest.php
│   │           │   ├── AtualizarStatusRequest.php
│   │           │   ├── ReagendarSolicitacaoRequest.php
│   │           │   └── AtualizarSolicitacaoRequest.php
│   │           └── Resources/
│   │               └── SolicitacaoResource.php
│   ├── Http/
│   │   └── Middleware/
│   │       └── RequestId.php
│   └── Models/
│       └── Solicitacao.php
├── database/
│   ├── factories/SolicitacaoFactory.php
│   ├── migrations/
│   └── seeders/
│       ├── DatabaseSeeder.php
│       └── SolicitacoesSeeder.php       # idempotente via firstOrCreate
├── routes/api.php
└── tests/
    └── Feature/
        ├── HealthTest.php
        ├── CriarSolicitacaoTest.php
        ├── AtualizarStatusTest.php
        └── ListarSolicitacoesTest.php
```

## Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Protocolo único | Upsert + `lockForUpdate` em `protocolo_counters` | Evita race condition sem sequence global; suporta rollback |
| Transições de status | Tabela `TRANSICOES` em Action | Toda regra de negócio fora do controller; fácil de testar |
| Geração de X-Request-ID | Middleware global no grupo `api` | Rastreabilidade sem acoplamento ao domínio |
| Seeders idempotentes | `firstOrCreate(['protocolo' => ...])` | `db:seed` pode rodar N vezes sem duplicar dados |
| Logs estruturados | JSON via `JsonFormatter` → stderr | Compatível com Loki/CloudWatch sem parsear texto |
| Error envelope único | `{message, errors}` em todos os erros | Frontend trata erros de forma uniforme |
| Fila operacional | Abertas, prioridade descendente, mais antigas primeiro | Mantém a ordem de atenção estável com paginação |
| Agendamento híbrido | Agendar via `PATCH /status`; reagendar via `PATCH /agendamento` | Uma única autoridade para transições; reagendar não é mudança de estado |
| Invariantes de agenda | CHECK no PostgreSQL + lock na Action | `AGENDADA` nunca fica sem horário, mesmo fora da API |
| Fuso da agenda | UTC no banco/API, `America/Recife` configurável na interpretação | Instante absoluto; horário local ambíguo é rejeitado |
| Horários repetidos | Permitidos (sem UNIQUE) | O edital não define capacidade; conflito exigiria recurso e duração |

## Evolução Futura

- **Autenticação:** Laravel Sanctum com tokens API para operadores
- **Fila de notificações:** Job `NotificarSolicitante` via `database` driver → SQS em produção
- **Eventos de domínio:** `SolicitacaoStatusAtualizado` → listeners desacoplados
- **Microsserviços:** Health + Solicitações já estão em namespaces separados — isolamento trivial

## Operação da fila

A listagem é ordenada no backend: solicitações ativas aparecem antes das encerradas; dentro de cada grupo, a prioridade é `URGENTE`, `ALTA`, `MEDIA`, `BAIXA`; empates usam a data de criação mais antiga e o `id` como desempate. O frontend apenas comunica essa regra e não reordena a resposta.
