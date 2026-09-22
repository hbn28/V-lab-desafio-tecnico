# Especificação técnica — Solicitações de Atendimento

Este arquivo é a fonte de verdade para dados, API e regras de negócio. Em caso de conflito com outros documentos do repositório, este arquivo prevalece. O edital oficial prevalece sobre todos os documentos internos.

## Escopo

O fluxo obrigatório é criar solicitação, listar/consultar, filtrar e atualizar status, com React + TypeScript consumindo exclusivamente a API Laravel e persistência em PostgreSQL. Autenticação não faz parte do núcleo; é bônus e só será considerada depois de o fluxo principal, os testes, o OpenAPI e o README estarem concluídos.

## Tipos do domínio

```typescript
export type Categoria = 'CONSULTA' | 'EXAME' | 'VACINACAO' | 'OUTRO';
export type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type Status = 'RECEBIDA' | 'EM_ANALISE' | 'AGENDADA' | 'CONCLUIDA' | 'CANCELADA';

export interface Solicitacao {
  id: number;
  protocolo: string;
  nome_solicitante: string;
  cpf_solicitante: string;
  data_nascimento: string;
  categoria: Categoria;
  prioridade: Prioridade;
  status: Status;
  agendado_para: string | null;
  descricao: string;
  justificativa_prioridade: string | null;
  data_criacao: string;
  data_atualizacao: string;
}
```

Datas são retornadas em UTC, no formato ISO 8601. No banco, os campos são `created_at` e `updated_at`; apenas o Resource os expõe como `data_criacao` e `data_atualizacao`.

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

`agendado_para` é `TIMESTAMP WITH TIME ZONE` nulo, persistido e retornado em UTC (ISO 8601), com índice simples. Invariantes protegidas por CHECK no PostgreSQL:

```sql
CHECK (status <> 'AGENDADA' OR agendado_para IS NOT NULL)
CHECK (status NOT IN ('RECEBIDA', 'EM_ANALISE') OR agendado_para IS NULL)
```

- `AGENDADA` sempre tem horário; `RECEBIDA` e `EM_ANALISE` nunca têm.
- `CONCLUIDA` e `CANCELADA` preservam o horário quando a solicitação foi agendada antes; podem ser nulos (cancelada antes de agendar ou dado legado).
- Não existe índice ou constraint única: **horários iguais para solicitações diferentes são permitidos**, e igualdade de horário não é conflito. Capacidade, vaga, duração, sala e profissional estão fora de escopo.
- A agenda **não registra chegada ao local** (check-in); a ordem real de chegada permanece fora do sistema, e não há priorização clínica automática.
- A migration converte registros legados `AGENDADA` em `EM_ANALISE` (sem inventar horário) antes de instalar as constraints; backend e banco devem ser implantados juntos.

### Fuso operacional

O Laravel permanece em UTC. A data/hora digitada é interpretada em `AGENDAMENTO_TIMEZONE` (padrão `America/Recife`; espelhada no frontend por `VITE_AGENDAMENTO_TIMEZONE`). Horário local inexistente ou ambíguo por mudança de offset é rejeitado com 422, sem normalização silenciosa. O instante deve ser estritamente futuro; segundos não são aceitos.

### Agendamento inicial

`PATCH /api/v1/solicitacoes/{id}/status` continua sendo a única via para entrar em `AGENDADA` (`EM_ANALISE → AGENDADA`, em `AtualizarStatusSolicitacao`):

```json
{ "status": "AGENDADA", "data_agendada": "2026-09-25", "hora_agendada": "14:30" }
```

- para `AGENDADA`, `data_agendada` (`YYYY-MM-DD`) e `hora_agendada` (`HH:mm`) são obrigatórias;
- para qualquer outro destino, esses campos são proibidos (422);
- campos desconhecidos retornam 422;
- `RECEBIDA → AGENDADA` continua 409, mesmo com payload completo.

### PATCH `/api/v1/solicitacoes/{id}/agendamento`

Reagendamento: altera somente `agendado_para` de uma solicitação já `AGENDADA`, na Action `ReagendarSolicitacao` (transação + `lockForUpdate`), que nunca altera `status`.

```json
{ "data_agendada": "2026-09-28", "hora_agendada": "09:00" }
```

Resposta 200: `{ "data": Solicitacao }`. Reenviar o mesmo instante é idempotente (200, sem escrita, `updated_at` inalterado). Solicitação fora de `AGENDADA` retorna 409; payload inválido, no passado ou com campo desconhecido retorna 422; inexistente retorna 404. Não é possível apagar o horário de uma solicitação agendada. Em reagendamentos concorrentes, o último válido processado vence (sem controle otimista por versão).

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

Query: `status`, `status_grupo`, `categoria`, `prioridade`, `data_agendada`, `page`, `per_page`.

- filtros vazios são tratados como ausentes;
- enums desconhecidos retornam 422;
- `page` deve ser inteiro >= 1;
- `per_page` deve ser inteiro entre 1 e 100, padrão 15;
- `status_grupo=aberto` retorna apenas `RECEBIDA`, `EM_ANALISE` e `AGENDADA`; a ordenação é `URGENTE`, `ALTA`, `MEDIA`, `BAIXA`, depois `created_at ASC` (mais antiga primeiro), com `id ASC` como desempate.
- `status_grupo=encerrado` retorna apenas `CONCLUIDA` e `CANCELADA`, por `updated_at DESC` (encerramento mais recente primeiro), com `id DESC` como desempate.
- sem `status_grupo`, a listagem preserva a ordenação legada: abertas primeiro, depois encerradas.
- `data_agendada=YYYY-MM-DD` seleciona a agenda de um dia operacional: restringe a `AGENDADA` com `agendado_para` no intervalo UTC semiaberto `[início do dia local, início do dia local seguinte)` e ordena por `agendado_para ASC`, prioridade (`URGENTE`, `ALTA`, `MEDIA`, `BAIXA`), `protocolo ASC` e `id ASC`. Combinar com `status` diferente de `AGENDADA` ou com `status_grupo=encerrado` retorna 422; `status_grupo=aberto` é aceito. Paginação preservada.
- `status=AGENDADA` sem `data_agendada` usa a mesma ordenação da agenda (`agendado_para ASC`, prioridade, protocolo, id) em vez da ordenação por prioridade/tempo de espera: uma vez marcado o horário, quem decide a ordem é o compromisso, não a prioridade administrativa (ADR 003, `docs/decisions/003-separar-fila-de-triagem-e-agenda.md`). Qualquer outro valor de `status` mantém a ordenação da fila operacional.

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

Campos aceitos: `status` (obrigatório, pertencente a `Status`) e, somente quando `status` é `AGENDADA`, `data_agendada` e `hora_agendada` (obrigatórios; ver "Agenda de solicitações"). Resposta 200: `{ "data": Solicitacao }`. Transição não permitida retorna 409.

## Extensão além do edital — editar e apagar

> **Atenção:** esta seção documenta uma extensão pedida explicitamente pelo candidato, fora do fluxo obrigatório descrito em "Escopo" (criar, listar/consultar, filtrar, atualizar status). O edital oficial (`Seleção V-LAB - Desafio Técnico Full Stack`, seção 2.2 a 2.5) não menciona editar nem apagar em nenhum requisito obrigatório, pontuável ou bônus — apenas define o fluxo mínimo e a máquina de estados de status. O edital também permite explicitamente estender as rotas sugeridas: "Alterações são permitidas desde que sejam consistentes, documentadas e preservem as funcionalidades solicitadas" (seção 2.3-C). Os dois endpoints abaixo seguem essa permissão e estão documentados aqui e no `docs/openapi.yaml`; não fazem parte do contrato mínimo avaliado.

### PUT `/api/v1/solicitacoes/{id}`

Substitui os dados cadastrais da solicitação (mesmas regras de validação do POST). `id`, `protocolo` e `status` continuam não graváveis. Resposta 200: `{ "data": Solicitacao }`.

Bloqueado (409) quando a solicitação está em estado final (`CONCLUIDA` ou `CANCELADA`) — dados de um atendimento encerrado não são mais editáveis.

### DELETE `/api/v1/solicitacoes/{id}`

Remove definitivamente a solicitação (hard delete). Permitido em qualquer estado. Resposta 204 sem corpo. Identificador inexistente retorna 404 no envelope comum.

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

Se autenticação for adicionada como bônus, 401 e 403 usarão o mesmo envelope.

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
- CHECK: `chk_agendada_com_horario` e `chk_estado_inicial_sem_horario` (ver "Agenda de solicitações").

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
