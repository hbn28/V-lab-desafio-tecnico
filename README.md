# Solicitações de Atendimento — V-Lab CIn/UFPE

Sistema de gerenciamento de solicitações de atendimento desenvolvido como desafio técnico para o processo seletivo do V-Lab.

## Acessar a demonstração

**Aplicação publicada:** [https://vlabsolicitacao.up.railway.app/](https://vlabsolicitacao.up.railway.app/)

Na tela de entrada, clique em **Criar conta**, informe nome, usuário (mínimo de 3 caracteres), senha (mínimo de 8 caracteres) e confirmação. O e-mail é opcional. A conta é criada com o perfil **ATENDENTE** e a sessão é iniciada automaticamente. Use somente informações fictícias ao experimentar o sistema. Se a opção não aparecer, o cadastro público foi desabilitado pelo administrador.

Em 24/09/2026, o endereço respondeu, o health check retornou `{"status":"ok","db":"ok"}` e `GET /api/v1/auth/cadastro` retornou `{"data":{"habilitado":true}}`. Essas verificações não substituem um teste completo de criação de conta e navegação autenticada. Administradores são criados separadamente com `php artisan operadores:criar`; o formulário público não concede esse perfil.

## Stack e versões

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | React + TypeScript + Vite | React 18, TS 5, Vite 5 |
| Backend | PHP + Laravel | PHP 8.3, Laravel 11 |
| Banco | PostgreSQL | 16 |
| Infra | Docker + Docker Compose | Compose v2 |

## Mapa da documentação

- [Contrato da API e dados](docs/spec.md) e [OpenAPI](docs/openapi.yaml)
- [Arquitetura e decisões](docs/architecture.md)
- [Design e temas](docs/design-system.md)
- [Implantação no Railway](docs/railway-deployment.md)
- [Revisão de acessibilidade](docs/accessibility-review.md) e [auditoria funcional](docs/functional-audit.md)
- [Auditoria dos requisitos do desafio](docs/auditoria-requisitos.md)

Os arquivos em `docs/superpowers/` registram planos e decisões históricas; o comportamento atual está no código, neste README e nos documentos acima.

## Como rodar

**Pré-requisitos:** Docker e Docker Compose instalados.

```bash
# Clonar e entrar na pasta
git clone https://github.com/hbn28/V-lab-desafio-tecnico.git
cd V-lab-desafio-tecnico

# Subir os serviços (frontend, backend, PostgreSQL e worker)
docker compose up --build
```

Aguarde até ver `Application ready` nos logs do backend (~30s na primeira vez). Depois:

| Serviço | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:8000/api/v1 |
| Health check | http://localhost:8000/api/v1/health |

> Com `APP_SEED=true` no `docker-compose.yml`, os seeders idempotentes preparam registros fictícios para desenvolvimento local, sem duplicá-los ao reiniciar.

Para entrar na interface local, use **Criar conta** na página inicial (`CADASTRO_PUBLICO=true` por padrão). A conta fica apenas no banco local. Para criar um administrador, execute `docker compose exec backend php artisan operadores:criar` e informe usuário e senha nos prompts. O Compose local instala as dependências de desenvolvimento para disponibilizar Pest e Pint; a imagem de produção instala apenas dependências de execução. O backend limpa manifestos de pacotes gerados no host ao iniciar.

As migrations são aplicadas automaticamente na inicialização. Para preservar os dados locais, não use `docker compose down -v`; se precisar de uma base limpa, crie um projeto Compose isolado com volumes próprios.

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/health` | Health check (banco + app) |
| GET | `/api/v1/auth/cadastro` | Informar se o cadastro público está habilitado |
| POST | `/api/v1/auth/cadastro` | Criar conta `ATENDENTE` e iniciar sessão |
| POST | `/api/v1/auth/login` | Entrar com usuário ou e-mail legado |
| GET | `/api/v1/auth/me` | Consultar operador autenticado |
| POST | `/api/v1/auth/logout` | Encerrar sessão |
| GET | `/api/v1/solicitacoes` | Listar com paginação e filtros |
| POST | `/api/v1/solicitacoes` | Criar solicitação |
| GET | `/api/v1/solicitacoes/{id}` | Buscar detalhes por ID |
| PATCH | `/api/v1/solicitacoes/{id}/status` | Atualizar status (`AGENDADA` exige data e horário ou turno) |
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

Agendar exige uma data e um horário exato ou turno (`MANHA`, `TARDE`, `NOITE`), interpretados no fuso operacional (`AGENDAMENTO_TIMEZONE`, padrão `America/Recife`; o frontend usa `VITE_AGENDAMENTO_TIMEZONE`, que deve ser o mesmo). O banco e a API trabalham em UTC. Solicitações diferentes podem ocupar o mesmo horário; não há capacidade, conflito de vaga nem registro de chegada.

```bash
# EM_ANALISE -> AGENDADA (exemplo com data e horário exato)
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

> **Implantação coordenada:** a migration converte registros legados `AGENDADA` sem agenda válida para `EM_ANALISE` e instala constraints para exigir um agendamento válido. Implante backend e banco juntos; um frontend antigo não consegue agendar sem os novos campos.

> As rotas `PUT` e `DELETE` são uma extensão fora do fluxo obrigatório do edital (criar, listar/consultar, filtrar, atualizar status). O edital não define nem proíbe editar/apagar, e permite explicitamente estender as rotas sugeridas desde que documentadas e consistentes (seção 2.3-C). Detalhes em [`docs/spec.md`](docs/spec.md#extensão-além-do-edital--editar-e-apagar).

Os exemplos de escrita acima exigem sessão de operador. No navegador, a interface obtém o cookie CSRF e mantém a sessão; para usar `curl`, envie os cookies e o cabeçalho `X-XSRF-TOKEN` conforme o [contrato OpenAPI](docs/openapi.yaml).

Documentação completa (OpenAPI): [`docs/openapi.yaml`](docs/openapi.yaml)

## Rodar os testes

O Compose local instala Pest e Pint no container `backend`. Ao iniciar em `APP_ENV=local`, o entrypoint cria o banco separado `vlab_test` se necessário, sem apagar dados. Em produção, a imagem instala apenas dependências de execução e não cria banco de testes. O job `test-backend` da CI também usa PostgreSQL 16 e banco isolado. Para reproduzir localmente:

```bash
docker compose exec backend php artisan migrate --database=pgsql_test --force
docker compose exec backend ./vendor/bin/pest
docker compose exec backend ./vendor/bin/pint --test
```

`backend/tests/TestCase.php` força `DB_CONNECTION=pgsql_test` antes de cada teste. Nunca execute migrations de teste, `migrate:fresh` ou `db:seed` no banco `vlab`.

Os testes do frontend podem ser executados no serviço local:

```bash
docker compose exec frontend npm test -- --run
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npm run lint
docker compose exec frontend npm run build
```

## Variáveis de ambiente

As variáveis de conexão (banco, URLs, etc.) já vêm configuradas no `docker-compose.yml` para ambiente local. A senha `secret` é uma credencial fixa **somente de desenvolvimento**, presente também em `backend/.env.example`; substitua-a antes de expor o banco em qualquer ambiente. Nenhuma credencial de produção deve ser versionada.

O fuso operacional da agenda é `AGENDAMENTO_TIMEZONE=America/Recife` (backend) e `VITE_AGENDAMENTO_TIMEZONE=America/Recife` (frontend); ambos estão em `docker-compose.yml` e nos `.env.example` e devem representar o mesmo fuso.

A `APP_KEY` **não** fica no `docker-compose.yml` nem em nenhum arquivo versionado: no primeiro `docker compose up`, o entrypoint do backend cria `backend/.env` a partir de `backend/.env.example` e gera a chave automaticamente (`php artisan key:generate`), salvando-a só localmente nesse arquivo (que está no `.gitignore`). Como `backend/.env` está no volume montado do host, a chave permanece estável entre reinícios (`docker compose down`/`up`) — só muda se você apagar o arquivo.

Se preferir gerar os `.env` manualmente antes de subir os containers:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Em produção, defina `APP_ENV=production`, gere uma `APP_KEY` própria e nunca reutilize a de desenvolvimento. Para implantar os serviços no Railway, veja [docs/railway-deployment.md](docs/railway-deployment.md).

## Funcionalidades implementadas

- Criar solicitação com protocolo único gerado automaticamente
- Listar solicitações com paginação, busca por nome/protocolo, filtros por status, categoria, prioridade e datas, e ordenação no servidor
- Visualizar detalhes de uma solicitação
- Atualizar status respeitando a máquina de estados
- Editar dados cadastrais de uma solicitação em aberto *(extensão fora do edital)*
- Apagar uma solicitação definitivamente *(extensão fora do edital)*
- Tela inicial com contadores por status e cartões de prioridades em aberto acima da fila, com acesso direto à lista filtrada
- Estados visuais de carregamento, erro, vazio e sucesso
- Validação de entradas com mensagens em português
- Autenticação de operadores com sessão Laravel e autorização por perfil (`ADMINISTRADOR`/`ATENDENTE`)
- Criação pública de contas `ATENDENTE` pela tela de login, controlada por `CADASTRO_PUBLICO` (padrão `true`; `false` desativa)
- Modo escuro no cabeçalho e na tela de acesso, com preferência salva no navegador e fallback para a preferência do sistema
- Health check da API com verificação do banco
- Fila operacional ordenada por estado aberto, prioridade e tempo de espera
- Agendamento e reagendamento com data e horário ou turno, e agenda diária no painel (`/?visao=agenda&data=AAAA-MM-DD`)
- Cadastro de paciente reaproveitado por CPF, com celular opcional e sempre exibido mascarado
- Fila operacional contínua (`GET /fila`), independente da paginação e dos filtros da listagem
- Agendamento por horário exato ou por turno (Manhã/Tarde/Noite)
- Registro de falta no agendamento, tentativa de contato enxuta (resultado fechado) e reagendamento após falta, com o histórico da ausência preservado (`/?visao=faltas`)
- Painel de notificações por operador para mudanças de status, processadas pelo worker após a confirmação no banco
- Navegação entre fila atual, agenda semanal, histórico encerrado e faltas; filtros e paginação próprios de cada visão

## Limitações conhecidas

- Sem recuperação de senha por e-mail; administradores são criados pelo comando interativo `operadores:criar`
- O campo `cpf_solicitante` aceita o formato `000.000.000-00` mas não valida dígitos verificadores
- A exclusão definitiva por administrador é uma extensão do desafio e pode apagar também o histórico relacionado; veja o risco documentado na [auditoria de requisitos](docs/auditoria-requisitos.md)

## Decisões arquiteturais

**Protocolo único:** gerado via `upsert + lockForUpdate` em tabela `protocolo_counters`, garantindo sequência sem race condition mesmo sob requisições simultâneas.

**Máquina de estados:** centralizada em `AtualizarStatusSolicitacao` com `DB::transaction + lockForUpdate`, tornando transições atômicas e testáveis de forma isolada.

**Controllers enxutos:** o controller autoriza e orquestra FormRequest → Action → Resource. As transições e operações de negócio ficam nas Actions; os FormRequests validam os payloads.

**RequestId:** middleware global propaga ou gera UUID `X-Request-ID` em cada requisição, gravando log JSON estruturado — facilita rastreamento em produção.

**Seeders idempotentes:** usam `firstOrCreate(['protocolo' => ...])` — `db:seed` pode rodar N vezes sem duplicar dados.

**Ordenação operacional:** a fila de triagem usa prioridade (`URGENTE` → `BAIXA`) e antiguidade, a agenda usa data e horário/turno e o histórico usa encerramento mais recente. A ordenação ocorre no servidor para permanecer estável com paginação.

**Modelo enriquecido:** além dos campos mínimos do edital, o modelo inclui `cpf_solicitante` e `data_nascimento` para refletir melhor um sistema real de saúde pública com dados fictícios.

Diagrama e decisões detalhadas: [`docs/architecture.md`](docs/architecture.md)

## Uso de inteligência artificial

Este projeto foi desenvolvido com apoio do **Claude (Anthropic)** via Cowork e do **Codex (OpenAI)**. As ferramentas foram usadas como apoio de implementação, revisão, correção e documentação; o candidato revisou e validou as alterações. O uso de IA foi declarado e é explicitamente encorajado pelo edital.

**Partes geradas com apoio de IA:**
- Estrutura inicial do projeto (scaffolding de pastas e arquivos base)
- Implementação das Actions, FormRequests e Resources do backend
- Componentes React e hooks de estado assíncrono
- Testes com Pest (backend) e Vitest/RTL (frontend)
- Especificação OpenAPI (`docs/openapi.yaml`)
- Documentação arquitetural (`docs/architecture.md`)
- Configuração do Docker e entrypoint do backend
- Auditoria das alterações, correções de segurança/privacidade, extração da Action da fila, atualização dos tipos/OpenAPI e revisão da documentação com apoio do Codex
- Atualização e consulta do grafo Graphify do repositório

**Responsabilidade do candidato:**
- Todo o código foi revisado e é compreendido pelo candidato
- As decisões arquiteturais (máquina de estados, protocolo com lock, controllers thin) foram discutidas e validadas
- O candidato é capaz de explicar e modificar qualquer parte do sistema na entrevista técnica
- Bugs encontrados durante o processo foram corrigidos iterativamente com e sem IA

A IA atuou como ferramenta de produtividade, não como substituta do raciocínio técnico.
