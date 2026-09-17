# Solicitações de Atendimento — V-Lab CIn/UFPE

Sistema de gerenciamento de solicitações de atendimento desenvolvido como desafio técnico para o processo seletivo do V-Lab.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | PHP 8.3 + Laravel 11 |
| Banco | PostgreSQL 16 |
| Infra | Docker + Docker Compose |

## Como rodar

**Pré-requisitos:** Docker e Docker Compose instalados.

```bash
# Clonar e entrar na pasta
git clone <url-do-repositorio>
cd <pasta>

# Subir todos os serviços (backend, frontend e banco)
docker compose up --build
```

Aguarde até ver `Application ready` nos logs do backend (~30s na primeira vez). Depois:

| Serviço | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:8000/api/v1 |
| Health check | http://localhost:8000/api/v1/health |

> Os seeders rodam automaticamente na primeira inicialização (`APP_SEED=true` no docker-compose.yml), populando 10 solicitações fictícias que cobrem todos os status e prioridades.

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/health` | Health check (banco + app) |
| GET | `/api/v1/solicitacoes` | Listar (filtros: `status`, `categoria`, `prioridade`, `page`, `per_page`) |
| POST | `/api/v1/solicitacoes` | Criar solicitação |
| GET | `/api/v1/solicitacoes/{id}` | Buscar por ID |
| PATCH | `/api/v1/solicitacoes/{id}/status` | Atualizar status |

Documentação completa: [`docs/openapi.yaml`](docs/openapi.yaml)

## Rodar os testes

```bash
# Testes de backend (Pest)
docker compose exec backend ./vendor/bin/pest

# Testes de frontend (Vitest)
docker compose exec frontend npm test -- --run
```

## Variáveis de ambiente

Copie os exemplos e ajuste conforme necessário:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

As variáveis já estão configuradas no `docker-compose.yml` para ambiente local. Em produção, substitua `APP_KEY`, `DB_PASSWORD` e defina `APP_ENV=production`.

## Decisões técnicas

- **Protocolo único:** gerado via `upsert + lockForUpdate` em tabela `protocolo_counters`, garantindo sequência sem race condition
- **Máquina de estados:** centralizada em `AtualizarStatusSolicitacao`, com `DB::transaction + lockForUpdate` para evitar transições concorrentes
- **Controllers thin:** toda lógica de negócio nas Actions; controller só faz FormRequest → Action → Resource
- **RequestId:** middleware global propaga/gera UUID `X-Request-ID` e grava log JSON estruturado por requisição
- **Seeders idempotentes:** usam `firstOrCreate(['protocolo' => ...])` — `db:seed` pode rodar N vezes sem duplicar dados

Diagrama completo: [`docs/architecture.md`](docs/architecture.md)
