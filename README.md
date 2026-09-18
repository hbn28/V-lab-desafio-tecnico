# Solicitações de Atendimento — V-Lab CIn/UFPE

Sistema de gerenciamento de solicitações de atendimento desenvolvido como desafio técnico para o processo seletivo do V-Lab.

## Stack e versões

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | React + TypeScript + Vite | React 18, TS 5, Vite 5 |
| Backend | PHP + Laravel | PHP 8.3, Laravel 11 |
| Banco | PostgreSQL | 16 |
| Infra | Docker + Docker Compose | Compose v2 |

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

**Se o banco já existir de uma execução anterior** e você alterou as migrations, recomece com:

```bash
docker compose down -v && docker compose up --build
```

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/health` | Health check (banco + app) |
| GET | `/api/v1/solicitacoes` | Listar com paginação e filtros |
| POST | `/api/v1/solicitacoes` | Criar solicitação |
| GET | `/api/v1/solicitacoes/{id}` | Buscar detalhes por ID |
| PATCH | `/api/v1/solicitacoes/{id}/status` | Atualizar status |
| PUT | `/api/v1/solicitacoes/{id}` | *(extensão)* Editar dados cadastrais — bloqueado se status for final |
| DELETE | `/api/v1/solicitacoes/{id}` | *(extensão)* Apagar solicitação definitivamente |

Filtros disponíveis em `GET /api/v1/solicitacoes`: `status`, `categoria`, `prioridade`, `page`, `per_page`.

> As rotas `PUT` e `DELETE` são uma extensão fora do fluxo obrigatório do edital (criar, listar/consultar, filtrar, atualizar status). O edital não define nem proíbe editar/apagar, e permite explicitamente estender as rotas sugeridas desde que documentadas e consistentes (seção 2.3-C). Detalhes em [`docs/spec.md`](docs/spec.md#extensão-além-do-edital--editar-e-apagar).

Documentação completa (OpenAPI): [`docs/openapi.yaml`](docs/openapi.yaml)

## Rodar os testes

```bash
# Testes de backend (Pest/PHPUnit)
docker compose exec backend ./vendor/bin/pest

# Testes de frontend (Vitest + React Testing Library)
docker compose exec frontend npm test -- --run
```

## Variáveis de ambiente

As variáveis de conexão (banco, URLs, etc.) já vêm configuradas no `docker-compose.yml` para ambiente local — nenhuma senha ou credencial real está versionada.

A `APP_KEY` **não** fica no `docker-compose.yml` nem em nenhum arquivo versionado: no primeiro `docker compose up`, o entrypoint do backend cria `backend/.env` a partir de `backend/.env.example` e gera a chave automaticamente (`php artisan key:generate`), salvando-a só localmente nesse arquivo (que está no `.gitignore`). Como `backend/.env` está no volume montado do host, a chave permanece estável entre reinícios (`docker compose down`/`up`) — só muda se você apagar o arquivo.

Se preferir gerar os `.env` manualmente antes de subir os containers:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Em produção, defina `APP_ENV=production`, gere uma `APP_KEY` própria e nunca reutilize a de desenvolvimento.

## Funcionalidades implementadas

- Criar solicitação com protocolo único gerado automaticamente
- Listar solicitações com paginação e filtros por status, categoria e prioridade
- Visualizar detalhes de uma solicitação
- Atualizar status respeitando a máquina de estados
- Editar dados cadastrais de uma solicitação em aberto *(extensão fora do edital)*
- Apagar uma solicitação definitivamente *(extensão fora do edital)*
- Tela inicial com resumo por status e prioridade
- Estados visuais de carregamento, erro, vazio e sucesso
- Validação de entradas com mensagens em português
- Health check da API com verificação do banco
- Fila operacional ordenada por estado aberto, prioridade e tempo de espera

## Limitações conhecidas

- Sem autenticação (não foi implementado o bônus de auth)
- O campo `cpf_solicitante` aceita o formato `000.000.000-00` mas não valida dígitos verificadores

## Decisões arquiteturais

**Protocolo único:** gerado via `upsert + lockForUpdate` em tabela `protocolo_counters`, garantindo sequência sem race condition mesmo sob requisições simultâneas.

**Máquina de estados:** centralizada em `AtualizarStatusSolicitacao` com `DB::transaction + lockForUpdate`, tornando transições atômicas e testáveis de forma isolada.

**Controllers thin:** o controller apenas repassa FormRequest → Action → Resource. Toda regra de negócio fica na Action; toda validação fica no FormRequest.

**RequestId:** middleware global propaga ou gera UUID `X-Request-ID` em cada requisição, gravando log JSON estruturado — facilita rastreamento em produção.

**Seeders idempotentes:** usam `firstOrCreate(['protocolo' => ...])` — `db:seed` pode rodar N vezes sem duplicar dados.

**Fila operacional:** a API ordena estados ativos antes dos encerrados, depois por prioridade (`URGENTE` → `BAIXA`) e, em caso de empate, pela solicitação mais antiga. A regra é server-side para permanecer estável com paginação.

**Modelo enriquecido:** além dos campos mínimos do edital, o modelo inclui `cpf_solicitante` e `data_nascimento` para refletir melhor um sistema real de saúde pública com dados fictícios.

Diagrama e decisões detalhadas: [`docs/architecture.md`](docs/architecture.md)

## Uso de inteligência artificial

Este projeto foi desenvolvido com auxílio do **Claude (Anthropic)** via ferramenta Cowork, operando em modo de engenharia autônoma (loop de implementação). O uso de IA foi declarado e é explicitamente encorajado pelo edital.

**Partes geradas com apoio de IA:**
- Estrutura inicial do projeto (scaffolding de pastas e arquivos base)
- Implementação das Actions, FormRequests e Resources do backend
- Componentes React e hooks de estado assíncrono
- Testes com Pest (backend) e Vitest/RTL (frontend)
- Especificação OpenAPI (`docs/openapi.yaml`)
- Documentação arquitetural (`docs/architecture.md`)
- Configuração do Docker e entrypoint do backend

**Responsabilidade do candidato:**
- Todo o código foi revisado e é compreendido pelo candidato
- As decisões arquiteturais (máquina de estados, protocolo com lock, controllers thin) foram discutidas e validadas
- O candidato é capaz de explicar e modificar qualquer parte do sistema na entrevista técnica
- Bugs encontrados durante o processo foram corrigidos iterativamente com e sem IA

A IA atuou como ferramenta de produtividade, não como substituta do raciocínio técnico.
