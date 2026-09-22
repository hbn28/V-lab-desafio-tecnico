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
| PATCH | `/api/v1/solicitacoes/{id}/status` | Atualizar status (`AGENDADA` exige `data_agendada` e `hora_agendada`) |
| PATCH | `/api/v1/solicitacoes/{id}/agendamento` | Reagendar uma solicitação já `AGENDADA` |
| PUT | `/api/v1/solicitacoes/{id}` | *(extensão)* Editar dados cadastrais — bloqueado se status for final |
| DELETE | `/api/v1/solicitacoes/{id}` | *(extensão)* Apagar solicitação definitivamente |
| GET | `/api/v1/fila` | Fila operacional contínua (entradas/saídas independentes da paginação) |
| GET | `/api/v1/faltas` | Agendamentos em falta, com telefone mascarado e última tentativa de contato |
| POST | `/api/v1/agendamentos/{id}/falta` | Registrar falta no agendamento (não altera `solicitacoes.status`) |
| POST | `/api/v1/agendamentos/{id}/tentativas-contato` | Registrar tentativa de contato (payload só `{ "resultado": ... }`) |
| POST | `/api/v1/agendamentos/{id}/reagendar-apos-falta` | Reagendar preservando a falta original como histórico |

Filtros disponíveis em `GET /api/v1/solicitacoes`: `status`, `categoria`, `prioridade`, `data_agendada`, `page`, `per_page`.

### Agenda

Agendar exige data e hora, interpretadas no fuso operacional (`AGENDAMENTO_TIMEZONE`, padrão `America/Recife`; o frontend usa `VITE_AGENDAMENTO_TIMEZONE`, que deve ser o mesmo). O banco e a API trabalham em UTC. Solicitações diferentes podem ocupar o mesmo horário; não há capacidade, conflito de vaga nem registro de chegada.

```bash
# EM_ANALISE -> AGENDADA (data e hora obrigatórias)
curl -X PATCH http://localhost:8000/api/v1/solicitacoes/1/status \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"status":"AGENDADA","data_agendada":"2026-09-25","hora_agendada":"14:30"}'

# Reagendar (só para solicitações AGENDADA; não muda o status)
curl -X PATCH http://localhost:8000/api/v1/solicitacoes/1/agendamento \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"data_agendada":"2026-09-28","hora_agendada":"09:00"}'

# Agenda de um dia (ordenada por horário, prioridade, protocolo)
curl "http://localhost:8000/api/v1/solicitacoes?data_agendada=2026-09-25"
```

### Paciente, fila, agenda por turno e faltas

```bash
# Criar solicitação com telefone opcional (paciente é reaproveitado por CPF em solicitações futuras)
curl -X POST http://localhost:8000/api/v1/solicitacoes \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"nome_solicitante":"Maria Silva","cpf_solicitante":"123.456.789-00","data_nascimento":"1985-06-15","categoria":"CONSULTA","prioridade":"ALTA","descricao":"Consulta de rotina","celular":"(81) 91234-5678"}'

# Entrar na fila (RECEBIDA -> EM_ANALISE abre uma EntradaFila)
curl -X PATCH http://localhost:8000/api/v1/solicitacoes/1/status \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"status":"EM_ANALISE"}'

# Agendar por horário exato
curl -X PATCH http://localhost:8000/api/v1/solicitacoes/1/status \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"status":"AGENDADA","data_agendada":"2026-09-25","hora_agendada":"07:00"}'

# ...ou por turno (sem horário exato; agendado_para fica null)
curl -X PATCH http://localhost:8000/api/v1/solicitacoes/2/status \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"status":"AGENDADA","data_agendada":"2026-09-25","turno":"TARDE"}'

# Fila operacional contínua
curl "http://localhost:8000/api/v1/fila"

# Marcar falta (só aceito após o horário/turno já ter passado)
curl -X POST http://localhost:8000/api/v1/agendamentos/1/falta

# Registrar contato após falta (payload fechado, sem texto livre)
curl -X POST http://localhost:8000/api/v1/agendamentos/1/tentativas-contato \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"resultado":"CONFIRMOU_RETORNO"}'

# Reagendar após falta (preserva o registro FALTA original como histórico)
curl -X POST http://localhost:8000/api/v1/agendamentos/1/reagendar-apos-falta \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"data_agendada":"2026-09-27","hora_agendada":"10:00"}'

# Faltas pendentes (para a aba "Faltas" do frontend)
curl "http://localhost:8000/api/v1/faltas"
```

> `solicitacoes.status` nunca vira `FALTA` — o estado é sempre do agendamento (`agendamentos.status`), como explicado em [`docs/architecture.md`](docs/architecture.md#faltas-por-que-o-estado-vive-no-agendamento).

> **Implantação coordenada:** a migration converte registros legados `AGENDADA` (sem horário) para `EM_ANALISE` e instala constraints que impedem `AGENDADA` sem horário. Implante backend e banco juntos; um frontend antigo não consegue agendar sem os novos campos.

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

O fuso operacional da agenda é `AGENDAMENTO_TIMEZONE=America/Recife` (backend) e `VITE_AGENDAMENTO_TIMEZONE=America/Recife` (frontend); ambos estão em `docker-compose.yml` e nos `.env.example` e devem representar o mesmo fuso.

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
- Agendamento e reagendamento com data e hora obrigatórias, e agenda diária no painel (`/?visao=agenda&data=AAAA-MM-DD`)
- Cadastro de paciente reaproveitado por CPF, com celular opcional e sempre exibido mascarado
- Fila operacional contínua (`GET /fila`), independente da paginação e dos filtros da listagem
- Agendamento por horário exato ou por turno (Manhã/Tarde/Noite)
- Registro de falta no agendamento, tentativa de contato enxuta (resultado fechado) e reagendamento após falta, com o histórico da ausência preservado (`/?visao=faltas`)

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
