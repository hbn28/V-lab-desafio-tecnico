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
  categoria: Categoria;
  prioridade: Prioridade;
  status: Status;
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

## Endpoints

### POST `/api/v1/solicitacoes`

Request:

```json
{
  "nome_solicitante": "Maria Silva",
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
| `categoria` | required, enum `Categoria` |
| `prioridade` | required, enum `Prioridade` |
| `descricao` | required, string, max:2000 |
| `justificativa_prioridade` | nullable; required e não vazia após trim quando `URGENTE`; string; max:1000 |

`id`, `protocolo`, `status`, timestamps e demais campos desconhecidos não são dados graváveis.

### GET `/api/v1/solicitacoes`

Query: `status`, `categoria`, `prioridade`, `page`, `per_page`.

- filtros vazios são tratados como ausentes;
- enums desconhecidos retornam 422;
- `page` deve ser inteiro >= 1;
- `per_page` deve ser inteiro entre 1 e 100, padrão 15;
- ordenação fixa: `created_at DESC`, com `id DESC` como desempate.

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

O único campo aceito é `status`, obrigatório e pertencente a `Status`. Resposta 200: `{ "data": Solicitacao }`. Transição não permitida retorna 409.

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
| 409 | transição incompatível com o status atual |
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
- `categoria`, `prioridade`, `status`: string com CHECK;
- `descricao`: text;
- `justificativa_prioridade`: text nullable;
- timestamps;
- índices individuais em `status`, `categoria` e `prioridade`;
- CHECK: prioridade diferente de `URGENTE` ou justificativa não nula e não vazia após `btrim`.

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
/                         resumo + listagem paginada + filtros
/solicitacoes/nova        criação
/solicitacoes/:id         detalhe + atualização de status
```

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
- frontend exibe erro 422 com cliente HTTP mockado.

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
