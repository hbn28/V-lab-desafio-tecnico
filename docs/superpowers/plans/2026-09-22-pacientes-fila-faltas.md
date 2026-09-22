# Pacientes, Fila, Agenda por Turno e Faltas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar paciente, solicitação, fila, agenda e falta, permitindo agendamento por horário ou turno, registro enxuto de contato e reagendamento após ausência sem violar o desafio técnico.

**Architecture:** A solicitação mantém a máquina de estados obrigatória e continua sendo a entidade avaliada pelo edital. Paciente, fila, agendamentos e tentativas de contato viram registros relacionados, com invariantes em PostgreSQL e Actions transacionais no domínio `Solicitacoes`; `solicitacoes.agendado_para` permanece apenas como compatibilidade para marcação com hora exata.

**Tech Stack:** PHP 8.3, Laravel 11, Pest 3, PostgreSQL 16, React 18, TypeScript 5.6, Vite 5, Vitest, Testing Library, Docker Compose e Graphify.

**Spec:** `docs/superpowers/specs/2026-09-22-pacientes-fila-faltas-design.md`

## Global Constraints

- O edital prevalece sobre este plano, a spec e qualquer documento interno.
- Preservar os estados obrigatórios: `RECEBIDA`, `EM_ANALISE`, `AGENDADA`, `CONCLUIDA`, `CANCELADA`.
- Preservar as transições obrigatórias em `AtualizarStatusSolicitacao`: `RECEBIDA -> EM_ANALISE/CANCELADA`, `EM_ANALISE -> AGENDADA/CANCELADA`, `AGENDADA -> CONCLUIDA/CANCELADA`; finais não mudam.
- Não criar status `FALTA` em `solicitacoes`; falta é status de `agendamentos`.
- `AtualizarStatusSolicitacao` permanece a única Action autorizada a alterar `solicitacoes.status`.
- Controllers seguem `FormRequest -> Action -> Resource`; regras ficam em Actions do domínio `Solicitacoes`.
- Toda mutação de status, fila, agendamento, falta, contato e reagendamento roda em `DB::transaction()` e relê as linhas necessárias com `lockForUpdate()`.
- Erros JSON mantêm `{ message, errors }`; 422 para entrada inválida e 409 para estado incompatível ou concorrência.
- Não criar Repository, DTO, CQRS, Event Sourcing, fila assíncrona, autenticação, envio real de mensagem, capacidade por sala/profissional ou integração externa.
- Telefone é opcional, administrativo, fictício em testes/seeders e sempre mascarado em listas, cartões, logs e payloads resumidos.
- O frontend não usa `any`, não corrige paginação com ordenação local e trata carregando, sucesso, vazio e erro em cada visão.
- Antes de implementação, confirmar RED; depois GREEN; cada tarefa termina com commit próprio.
- Após mudanças de código, rodar `graphify update .` antes do encerramento final.
- Preservar alterações locais já existentes que não pertençam a esta feature.

## Review Focus

- CPF já cadastrado com nascimento diferente deve retornar 422 e não mesclar duas pessoas distintas; coberto na Task 2.
- Hora e turno enviados juntos, ou ambos ausentes, devem retornar 422; coberto nas Tasks 3 e 4.
- Falta antes do horário, ou antes do fim do turno, deve retornar 422; coberto na Task 5.
- Contato com campo livre, canal ou observação deve ser rejeitado; coberto na Task 5.
- Reagendar após falta deve criar novo agendamento ativo e preservar o antigo em `FALTA`; coberto na Task 6.

---

## Preflight Obrigatório

- [ ] **Step 1: Ler as fontes de verdade**

Run:

```powershell
Get-Content -Raw AGENTS.md
Get-Content -Raw HANDOFF.md
Get-Content -Raw docs/spec.md
Get-Content -Raw TASKS.md
Get-Content -Raw docs/agent-playbook.md
Get-Content -Raw docs/codebase-map.md
Get-Content -Raw docs/superpowers/specs/2026-09-22-pacientes-fila-faltas-design.md
```

Expected: confirmar que não há conflito com o edital nem com a máquina de estados.

- [ ] **Step 2: Consultar Graphify**

Run:

```powershell
& "$env:APPDATA\Python\Python312\Scripts\graphify.exe" query "AtualizarStatusSolicitacao ReagendarSolicitacao SolicitacaoController SolicitacaoResource AgendamentoForm SolicitacoesPage tests"
```

Expected: Graphify retorna os pontos de extensão do backend, frontend e testes. Se a CLI não estiver disponível, usar `docs/codebase-map.md` como fallback e registrar isso no `HANDOFF.md`.

- [ ] **Step 3: Confirmar base verde**

Run:

```powershell
docker compose up -d
docker compose exec backend ./vendor/bin/pest
Set-Location frontend
npm run test -- --run
npm run lint
npm run build
Set-Location ..
```

Expected: todos os comandos com exit code 0. Se a base falhar por motivo não relacionado, parar este plano e usar `superpowers:systematic-debugging`.

## File Structure

### Backend

- Create: `backend/app/Models/Paciente.php` — identidade reutilizável por CPF.
- Create: `backend/app/Models/EntradaFila.php` — passagem contínua pela fila.
- Create: `backend/app/Models/Agendamento.php` — marcações por horário ou turno e status da agenda.
- Create: `backend/app/Models/TentativaContato.php` — resultado administrativo fechado após falta.
- Create: `backend/database/migrations/2026_09_22_000001_create_pacientes_table.php`
- Create: `backend/database/migrations/2026_09_22_000002_add_paciente_id_to_solicitacoes_table.php`
- Create: `backend/database/migrations/2026_09_22_000003_create_entradas_fila_table.php`
- Create: `backend/database/migrations/2026_09_22_000004_create_agendamentos_table.php`
- Create: `backend/database/migrations/2026_09_22_000005_create_tentativas_contato_table.php`
- Create: `backend/database/migrations/2026_09_22_000006_migrate_agenda_and_replace_legacy_checks.php`
- Create: `backend/app/Domain/Solicitacoes/Support/TurnoAgendamento.php` — turnos fixos e elegibilidade de falta.
- Create: `backend/app/Domain/Solicitacoes/Support/MascararContato.php` — telefone mascarado.
- Create: `backend/app/Domain/Solicitacoes/Actions/RegistrarFaltaAgendamento.php`
- Create: `backend/app/Domain/Solicitacoes/Actions/RegistrarTentativaContato.php`
- Create: `backend/app/Domain/Solicitacoes/Actions/ReagendarAposFalta.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Requests/RegistrarTentativaContatoRequest.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Requests/ReagendarAposFaltaRequest.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Requests/ListarFilaRequest.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Requests/ListarFaltasRequest.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Resources/PacienteResumoResource.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Resources/EntradaFilaResource.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Resources/AgendamentoResource.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Resources/TentativaContatoResource.php`
- Modify: `backend/app/Domain/Solicitacoes/Actions/CriarSolicitacao.php`
- Modify: `backend/app/Domain/Solicitacoes/Actions/AtualizarStatusSolicitacao.php`
- Modify: `backend/app/Domain/Solicitacoes/Actions/ReagendarSolicitacao.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Requests/CriarSolicitacaoRequest.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Requests/AtualizarStatusRequest.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Requests/ReagendarSolicitacaoRequest.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Resources/SolicitacaoResource.php`
- Modify: `backend/app/Models/Solicitacao.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/database/factories/SolicitacaoFactory.php`
- Modify: `backend/database/seeders/SolicitacoesSeeder.php`

### Backend Tests

- Create: `backend/tests/Feature/PacienteSolicitacaoTest.php`
- Create: `backend/tests/Feature/FilaOperacionalTest.php`
- Create: `backend/tests/Feature/AgendamentoTurnoTest.php`
- Create: `backend/tests/Feature/FaltasTest.php`
- Create: `backend/tests/Feature/ReagendarAposFaltaTest.php`
- Modify: `backend/tests/Feature/CriarSolicitacaoTest.php`
- Modify: `backend/tests/Feature/AtualizarStatusTest.php`
- Modify: `backend/tests/Feature/ReagendarSolicitacaoTest.php`
- Modify: `backend/tests/Feature/ListarSolicitacoesTest.php`
- Modify: `backend/tests/Unit/HorarioAgendamentoTest.php`

### Frontend

- Modify: `frontend/src/features/solicitacoes/types/index.ts`
- Modify: `frontend/src/features/solicitacoes/api/client.ts`
- Modify: `frontend/src/features/solicitacoes/components/SolicitacaoForm.tsx`
- Modify: `frontend/src/features/solicitacoes/components/AgendamentoForm.tsx`
- Create: `frontend/src/features/solicitacoes/components/GrupoTurnoAgenda.tsx`
- Create: `frontend/src/features/solicitacoes/components/FaltaCard.tsx`
- Create: `frontend/src/features/solicitacoes/components/ContatoFaltaDialog.tsx`
- Modify: `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx`
- Modify: `frontend/src/features/solicitacoes/pages/SolicitacaoDetailPage.tsx`
- Modify: `frontend/src/features/solicitacoes/config/agendamento.ts`
- Modify: `frontend/src/index.css`

### Frontend Tests

- Create: `frontend/src/test/agendamento-turno.test.tsx`
- Create: `frontend/src/test/faltas.test.tsx`
- Modify: `frontend/src/test/agendamento-form.test.tsx`
- Modify: `frontend/src/test/agendamento-detalhe.test.tsx`
- Modify: `frontend/src/test/agenda.test.tsx`
- Modify: `frontend/src/test/solicitacoes.test.tsx`

### Documentation

- Modify: `docs/spec.md`
- Modify: `docs/openapi.yaml`
- Modify: `docs/architecture.md`
- Modify: `docs/codebase-map.md`
- Modify: `README.md`
- Modify: `TASKS.md`
- Rewrite: `HANDOFF.md`

---

### Task 1: Persistência de Paciente, Fila, Agendamento e Contato

**Files:**
- Create all migrations and models listed in the Backend section for persistence.
- Modify: `backend/app/Models/Solicitacao.php`
- Test: `backend/tests/Feature/PacienteSolicitacaoTest.php`, `backend/tests/Feature/AgendamentoTurnoTest.php`

**Interfaces:**
- Produces: `Paciente` model with `solicitacoes(): HasMany`.
- Produces: `Solicitacao::paciente(): BelongsTo`.
- Produces: `Solicitacao::entradasFila(): HasMany`, `entradaFilaAberta(): HasOne`.
- Produces: `Solicitacao::agendamentos(): HasMany`, `agendamentoAtivo(): HasOne`.
- Produces: `Agendamento::tentativasContato(): HasMany`, `ultimaTentativaContato(): HasOne`.

- [ ] **Step 1: Write failing persistence tests**

Create `backend/tests/Feature/PacienteSolicitacaoTest.php`:

```php
<?php

use App\Models\Paciente;
use App\Models\Solicitacao;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('solicitacao pertence a paciente e preserva snapshot historico', function () {
    $paciente = Paciente::factory()->create([
        'nome' => 'Maria da Silva',
        'cpf' => '12345678900',
        'data_nascimento' => '1985-06-15',
        'celular' => '81999990000',
    ]);

    $solicitacao = Solicitacao::factory()->create([
        'paciente_id' => $paciente->id,
        'nome_solicitante' => 'Maria da Silva',
        'cpf_solicitante' => '123.456.789-00',
        'data_nascimento' => '1985-06-15',
    ]);

    expect($solicitacao->paciente->is($paciente))->toBeTrue()
        ->and($paciente->solicitacoes()->count())->toBe(1)
        ->and($solicitacao->cpf_solicitante)->toBe('123.456.789-00');
});
```

Create `backend/tests/Feature/AgendamentoTurnoTest.php`:

```php
<?php

use App\Models\Agendamento;
use App\Models\Solicitacao;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('banco permite apenas um agendamento ativo por solicitacao', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'AGENDADA']);

    Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'AGENDADO',
        'modalidade' => 'TURNO',
        'data_agendada' => '2026-09-25',
        'turno' => 'MANHA',
        'hora_agendada' => null,
    ]);

    expect(fn () => Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'AGENDADO',
        'modalidade' => 'TURNO',
        'data_agendada' => '2026-09-26',
        'turno' => 'TARDE',
        'hora_agendada' => null,
    ]))->toThrow(QueryException::class);
});

test('check rejeita combinacao ambigua de modalidade e hora', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'AGENDADA']);

    expect(fn () => Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'AGENDADO',
        'modalidade' => 'TURNO',
        'data_agendada' => '2026-09-25',
        'turno' => 'MANHA',
        'hora_agendada' => '07:00',
    ]))->toThrow(QueryException::class);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
docker compose exec backend ./vendor/bin/pest tests/Feature/PacienteSolicitacaoTest.php tests/Feature/AgendamentoTurnoTest.php
```

Expected: FAIL because models, factories and tables do not exist.

- [ ] **Step 3: Create migrations**

Implement migrations with these exact constraints:

```php
// pacientes
$table->id();
$table->string('nome');
$table->string('cpf', 11)->unique();
$table->date('data_nascimento');
$table->string('celular', 11)->nullable();
$table->timestamps();
```

```php
// entradas_fila
$table->id();
$table->foreignId('solicitacao_id')->constrained('solicitacoes')->cascadeOnDelete();
$table->timestampTz('entrou_em');
$table->timestampTz('encerrada_em')->nullable();
$table->string('motivo_encerramento')->nullable();
$table->timestamps();
$table->check("motivo_encerramento IS NULL OR motivo_encerramento IN ('AGENDAMENTO','CANCELAMENTO')");
DB::statement('CREATE UNIQUE INDEX entradas_fila_aberta_unique ON entradas_fila (solicitacao_id) WHERE encerrada_em IS NULL');
```

```php
// agendamentos
$table->id();
$table->foreignId('solicitacao_id')->constrained('solicitacoes')->cascadeOnDelete();
$table->date('data_agendada');
$table->string('modalidade');
$table->time('hora_agendada')->nullable();
$table->string('turno');
$table->string('status');
$table->timestampTz('resultado_em')->nullable();
$table->timestampTz('falta_registrada_em')->nullable();
$table->timestampTz('falta_corrigida_em')->nullable();
$table->timestamps();
$table->check("modalidade IN ('HORARIO','TURNO')");
$table->check("turno IN ('MANHA','TARDE','NOITE')");
$table->check("status IN ('AGENDADO','REALIZADO','FALTA','CANCELADO')");
$table->check("((modalidade = 'HORARIO' AND hora_agendada IS NOT NULL AND turno IS NOT NULL) OR (modalidade = 'TURNO' AND hora_agendada IS NULL AND turno IS NOT NULL))");
$table->index(['data_agendada', 'turno', 'hora_agendada']);
$table->index('status');
DB::statement("CREATE UNIQUE INDEX agendamento_ativo_unique ON agendamentos (solicitacao_id) WHERE status = 'AGENDADO'");
```

```php
// tentativas_contato
$table->id();
$table->foreignId('agendamento_id')->constrained('agendamentos')->cascadeOnDelete();
$table->string('resultado');
$table->timestampTz('realizada_em');
$table->timestamps();
$table->check("resultado IN ('SEM_RESPOSTA','RECADO','CONFIRMOU_RETORNO','NUMERO_INVALIDO')");
$table->index(['agendamento_id', 'realizada_em']);
```

Add `paciente_id` to `solicitacoes` as nullable first, backfill by normalized CPF, then make it not nullable:

```php
$table->foreignId('paciente_id')->nullable()->after('id')->constrained('pacientes')->restrictOnDelete();
```

In the backfill step, create one patient per normalized CPF from existing `solicitacoes`, then update `solicitacoes.paciente_id`. After backfill, run:

```php
DB::statement('ALTER TABLE solicitacoes ALTER COLUMN paciente_id SET NOT NULL');
```

- [ ] **Step 4: Migrate existing agenda data**

In `2026_09_22_000006_migrate_agenda_and_replace_legacy_checks.php`, before dropping legacy checks, create `agendamentos` for existing rows with `agendado_para`:

```php
$timezone = config('agendamento.timezone', 'America/Recife');
Solicitacao::query()->whereNotNull('agendado_para')->each(function (Solicitacao $solicitacao) use ($timezone) {
    $local = $solicitacao->agendado_para->setTimezone($timezone);
    Agendamento::query()->create([
        'solicitacao_id' => $solicitacao->id,
        'data_agendada' => $local->toDateString(),
        'modalidade' => 'HORARIO',
        'hora_agendada' => $local->format('H:i'),
        'turno' => TurnoAgendamento::derivarDaHora($local->format('H:i')),
        'status' => match ($solicitacao->status) {
            'CONCLUIDA' => 'REALIZADO',
            'CANCELADA' => 'CANCELADO',
            default => 'AGENDADO',
        },
        'resultado_em' => in_array($solicitacao->status, ['CONCLUIDA', 'CANCELADA'], true) ? $solicitacao->updated_at : null,
    ]);
});
```

Drop legacy checks `chk_agendada_com_horario` and `chk_estado_inicial_sem_horario`. Do not remove the `agendado_para` column.

- [ ] **Step 5: Create models, factories and relationships**

Use `$fillable` and casts:

```php
// Agendamento
protected $fillable = ['solicitacao_id', 'data_agendada', 'modalidade', 'hora_agendada', 'turno', 'status', 'resultado_em', 'falta_registrada_em', 'falta_corrigida_em'];
protected $casts = ['data_agendada' => 'date:Y-m-d', 'resultado_em' => 'immutable_datetime', 'falta_registrada_em' => 'immutable_datetime', 'falta_corrigida_em' => 'immutable_datetime'];
```

Add factories for `Paciente`, `EntradaFila`, `Agendamento`, `TentativaContato`. Factories must use fake pt_BR data only.

- [ ] **Step 6: Run migrations and persistence tests**

Run:

```powershell
docker compose exec backend php artisan migrate:fresh --seed
docker compose exec backend ./vendor/bin/pest tests/Feature/PacienteSolicitacaoTest.php tests/Feature/AgendamentoTurnoTest.php
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add backend/app/Models backend/database/migrations backend/database/factories backend/database/seeders backend/tests/Feature/PacienteSolicitacaoTest.php backend/tests/Feature/AgendamentoTurnoTest.php backend/app/Models/Solicitacao.php
git commit -m "feat(solicitacoes): adiciona modelo de paciente fila e agenda"
```

---

### Task 2: Criação de Solicitação com Reuso de Paciente

**Files:**
- Modify: `backend/tests/Feature/CriarSolicitacaoTest.php`
- Modify: `backend/tests/Feature/PacienteSolicitacaoTest.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Requests/CriarSolicitacaoRequest.php`
- Modify: `backend/app/Domain/Solicitacoes/Actions/CriarSolicitacao.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Resources/SolicitacaoResource.php`
- Modify: `backend/app/Models/Solicitacao.php`
- Modify: `backend/app/Models/Paciente.php`

**Interfaces:**
- Consumes: `Paciente` model from Task 1.
- Produces: `CriarSolicitacao` creates or reuses `Paciente` by normalized CPF.
- Produces: `SolicitacaoResource` returns `paciente` summary and `celular_mascarado`.

- [ ] **Step 1: Write failing tests for patient reuse and conflict**

Append to `PacienteSolicitacaoTest.php`:

```php
test('criar solicitacao reutiliza paciente pelo cpf normalizado', function () {
    $paciente = Paciente::factory()->create([
        'nome' => 'Maria da Silva',
        'cpf' => '12345678900',
        'data_nascimento' => '1985-06-15',
        'celular' => '81999990000',
    ]);

    $response = $this->postJson('/api/v1/solicitacoes', [
        'nome_solicitante' => 'Maria da Silva',
        'cpf_solicitante' => '123.456.789-00',
        'data_nascimento' => '1985-06-15',
        'celular' => '(81) 99999-0000',
        'categoria' => 'CONSULTA',
        'prioridade' => 'MEDIA',
        'descricao' => 'Consulta ficticia.',
        'justificativa_prioridade' => null,
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.paciente.id', $paciente->id)
        ->assertJsonPath('data.paciente.celular_mascarado', '(81) *****-0000');

    expect(Paciente::count())->toBe(1);
});

test('cpf existente com nascimento divergente retorna 422', function () {
    Paciente::factory()->create([
        'nome' => 'Maria da Silva',
        'cpf' => '12345678900',
        'data_nascimento' => '1985-06-15',
    ]);

    $this->postJson('/api/v1/solicitacoes', [
        'nome_solicitante' => 'Maria da Silva',
        'cpf_solicitante' => '123.456.789-00',
        'data_nascimento' => '1990-01-20',
        'categoria' => 'CONSULTA',
        'prioridade' => 'MEDIA',
        'descricao' => 'Consulta ficticia.',
        'justificativa_prioridade' => null,
    ])->assertStatus(422)->assertJsonStructure(['message', 'errors' => ['cpf_solicitante']]);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
docker compose exec backend ./vendor/bin/pest tests/Feature/PacienteSolicitacaoTest.php tests/Feature/CriarSolicitacaoTest.php
```

Expected: FAIL because creation does not manage patients and `celular` is rejected or ignored.

- [ ] **Step 3: Update request validation**

In `CriarSolicitacaoRequest`, accept optional `celular`:

```php
'celular' => ['nullable', 'string', 'regex:/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/'],
```

Keep `status`, `id`, `protocolo`, timestamps and unknown fields rejected as currently done. Normalize only inside the Action, not in the controller.

- [ ] **Step 4: Implement patient reuse inside the protocol transaction**

Inside `CriarSolicitacao::execute`, before creating `Solicitacao`, normalize CPF and phone:

```php
$cpf = preg_replace('/\D+/', '', $dados['cpf_solicitante']);
$celular = isset($dados['celular']) ? preg_replace('/\D+/', '', $dados['celular']) : null;

$paciente = Paciente::query()->where('cpf', $cpf)->lockForUpdate()->first();

if ($paciente !== null && $paciente->data_nascimento->toDateString() !== $dados['data_nascimento']) {
    throw ValidationException::withMessages([
        'cpf_solicitante' => ['CPF já cadastrado com outra data de nascimento.'],
    ]);
}

if ($paciente === null) {
    $paciente = Paciente::query()->create([
        'nome' => $dados['nome_solicitante'],
        'cpf' => $cpf,
        'data_nascimento' => $dados['data_nascimento'],
        'celular' => $celular,
    ]);
} elseif ($celular !== null && $paciente->celular !== $celular) {
    $paciente->update(['celular' => $celular]);
}

$dados['paciente_id'] = $paciente->id;
unset($dados['celular']);
```

Do not overwrite `nome_solicitante`, `cpf_solicitante` or `data_nascimento` snapshots on the request.

- [ ] **Step 5: Add masked output resource**

Create `PacienteResumoResource`:

```php
return [
    'id' => $this->id,
    'nome' => $this->nome,
    'celular_mascarado' => MascararContato::celular($this->celular),
];
```

Create `MascararContato::celular(?string $celular): ?string` returning `null` for blank and `(81) *****-0000` for `81999990000`.

Add to `SolicitacaoResource`:

```php
'paciente' => new PacienteResumoResource($this->whenLoaded('paciente')),
```

Ensure controller eager loads `paciente` for create, detail and list responses.

- [ ] **Step 6: Run tests**

Run:

```powershell
docker compose exec backend ./vendor/bin/pest tests/Feature/PacienteSolicitacaoTest.php tests/Feature/CriarSolicitacaoTest.php
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add backend/app/Domain/Solicitacoes/Actions/CriarSolicitacao.php backend/app/Domain/Solicitacoes/Http/Requests/CriarSolicitacaoRequest.php backend/app/Domain/Solicitacoes/Http/Resources backend/app/Domain/Solicitacoes/Support/MascararContato.php backend/app/Models backend/tests/Feature/PacienteSolicitacaoTest.php backend/tests/Feature/CriarSolicitacaoTest.php
git commit -m "feat(solicitacoes): reutiliza cadastro de paciente"
```

---

### Task 3: Fila Contínua e Efeitos da Máquina de Estados

**Files:**
- Create: `backend/tests/Feature/FilaOperacionalTest.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Requests/ListarFilaRequest.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Resources/EntradaFilaResource.php`
- Modify: `backend/app/Domain/Solicitacoes/Actions/AtualizarStatusSolicitacao.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Produces: `GET /api/v1/fila`.
- Produces: status transition side effects for `entradas_fila`.

- [ ] **Step 1: Write failing queue tests**

Create `FilaOperacionalTest.php`:

```php
<?php

use App\Models\EntradaFila;
use App\Models\Solicitacao;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('RECEBIDA para EM_ANALISE abre entrada de fila uma unica vez', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'RECEBIDA']);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", ['status' => 'EM_ANALISE'])->assertOk();

    expect(EntradaFila::where('solicitacao_id', $solicitacao->id)->whereNull('encerrada_em')->count())->toBe(1);
});

test('agendar encerra entrada de fila com motivo AGENDAMENTO', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'EM_ANALISE']);
    EntradaFila::factory()->create(['solicitacao_id' => $solicitacao->id, 'entrou_em' => now()->subDay()]);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", [
        'status' => 'AGENDADA',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '07:00',
    ])->assertOk();

    $entrada = EntradaFila::where('solicitacao_id', $solicitacao->id)->first();
    expect($entrada->encerrada_em)->not->toBeNull()
        ->and($entrada->motivo_encerramento)->toBe('AGENDAMENTO');
});

test('GET fila lista apenas entradas abertas por prioridade e entrada mais antiga', function () {
    $baixa = Solicitacao::factory()->create(['status' => 'EM_ANALISE', 'prioridade' => 'BAIXA']);
    $urgenteNova = Solicitacao::factory()->create(['status' => 'EM_ANALISE', 'prioridade' => 'URGENTE']);
    $urgenteAntiga = Solicitacao::factory()->create(['status' => 'EM_ANALISE', 'prioridade' => 'URGENTE']);
    EntradaFila::factory()->create(['solicitacao_id' => $baixa->id, 'entrou_em' => now()->subDays(5)]);
    EntradaFila::factory()->create(['solicitacao_id' => $urgenteNova->id, 'entrou_em' => now()->subHour()]);
    EntradaFila::factory()->create(['solicitacao_id' => $urgenteAntiga->id, 'entrou_em' => now()->subHours(3)]);

    $this->getJson('/api/v1/fila')->assertOk()
        ->assertJsonPath('data.0.solicitacao.id', $urgenteAntiga->id)
        ->assertJsonPath('data.1.solicitacao.id', $urgenteNova->id)
        ->assertJsonPath('data.2.solicitacao.id', $baixa->id);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
docker compose exec backend ./vendor/bin/pest tests/Feature/FilaOperacionalTest.php
```

Expected: FAIL because side effects and `/fila` do not exist.

- [ ] **Step 3: Implement queue side effects in `AtualizarStatusSolicitacao`**

Inside the existing locked transaction:

```php
if ($novoStatus === 'EM_ANALISE') {
    EntradaFila::query()->firstOrCreate(
        ['solicitacao_id' => $solicitacao->id, 'encerrada_em' => null],
        ['entrou_em' => now()]
    );
}

if ($novoStatus === 'AGENDADA') {
    $this->encerrarFilaAberta($solicitacao, 'AGENDAMENTO');
}

if ($novoStatus === 'CANCELADA') {
    $this->encerrarFilaAberta($solicitacao, 'CANCELAMENTO');
}
```

Implement private method:

```php
private function encerrarFilaAberta(Solicitacao $solicitacao, string $motivo): void
{
    EntradaFila::query()
        ->where('solicitacao_id', $solicitacao->id)
        ->whereNull('encerrada_em')
        ->lockForUpdate()
        ->update(['encerrada_em' => now(), 'motivo_encerramento' => $motivo]);
}
```

- [ ] **Step 4: Implement `/api/v1/fila`**

`ListarFilaRequest` accepts `prioridade`, `categoria`, `page`, `per_page` with the same enum and pagination limits already used by `ListarSolicitacoesRequest`.

In controller:

```php
$query = EntradaFila::query()
    ->whereNull('encerrada_em')
    ->with(['solicitacao.paciente'])
    ->join('solicitacoes', 'solicitacoes.id', '=', 'entradas_fila.solicitacao_id')
    ->when($request->validated('prioridade'), fn ($q, $p) => $q->where('solicitacoes.prioridade', $p))
    ->when($request->validated('categoria'), fn ($q, $c) => $q->where('solicitacoes.categoria', $c))
    ->orderByRaw("CASE solicitacoes.prioridade WHEN 'URGENTE' THEN 4 WHEN 'ALTA' THEN 3 WHEN 'MEDIA' THEN 2 ELSE 1 END DESC")
    ->orderBy('entradas_fila.entrou_em')
    ->orderBy('entradas_fila.id')
    ->select('entradas_fila.*');
```

Return `EntradaFilaResource::collection($paginator)`.

- [ ] **Step 5: Run queue tests**

Run:

```powershell
docker compose exec backend ./vendor/bin/pest tests/Feature/FilaOperacionalTest.php tests/Feature/AtualizarStatusTest.php
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add backend/tests/Feature/FilaOperacionalTest.php backend/app/Domain/Solicitacoes/Actions/AtualizarStatusSolicitacao.php backend/app/Domain/Solicitacoes/Http/Requests/ListarFilaRequest.php backend/app/Domain/Solicitacoes/Http/Resources/EntradaFilaResource.php backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php backend/routes/api.php
git commit -m "feat(solicitacoes): adiciona fila operacional continua"
```

---

### Task 4: Agendamento por Horário ou Turno

**Files:**
- Create: `backend/app/Domain/Solicitacoes/Support/TurnoAgendamento.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Requests/AtualizarStatusRequest.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Requests/ReagendarSolicitacaoRequest.php`
- Modify: `backend/app/Domain/Solicitacoes/Actions/AtualizarStatusSolicitacao.php`
- Modify: `backend/app/Domain/Solicitacoes/Actions/ReagendarSolicitacao.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Resources/SolicitacaoResource.php`
- Modify: `backend/tests/Feature/AgendamentoTurnoTest.php`
- Modify: `backend/tests/Feature/AtualizarStatusTest.php`
- Modify: `backend/tests/Feature/ReagendarSolicitacaoTest.php`

**Interfaces:**
- Produces: `TurnoAgendamento::derivarDaHora(string $hora): string`.
- Produces: `TurnoAgendamento::fimDoTurnoUtc(string $data, string $turno, string $timezone): CarbonImmutable`.
- Produces: agendamento input accepts exactly `{data_agendada, hora_agendada}` or `{data_agendada, turno}`.

- [ ] **Step 1: Write failing tests for hour and shift modes**

Append to `AgendamentoTurnoTest.php`:

```php
test('horario deriva turno automaticamente', function (string $hora, string $turno) {
    expect(TurnoAgendamento::derivarDaHora($hora))->toBe($turno);
})->with([
    ['07:00', 'MANHA'],
    ['14:00', 'TARDE'],
    ['19:00', 'NOITE'],
    ['05:59', 'NOITE'],
]);

test('AGENDADA aceita turno sem hora e mantem agendado_para nulo', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'EM_ANALISE']);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", [
        'status' => 'AGENDADA',
        'data_agendada' => '2026-09-25',
        'turno' => 'MANHA',
    ])->assertOk()
        ->assertJsonPath('data.status', 'AGENDADA')
        ->assertJsonPath('data.agendado_para', null)
        ->assertJsonPath('data.agendamento_ativo.modalidade', 'TURNO')
        ->assertJsonPath('data.agendamento_ativo.turno', 'MANHA');
});

test('payload ambiguo de agenda retorna 422', function (array $payload, string $campo) {
    $solicitacao = Solicitacao::factory()->create(['status' => 'EM_ANALISE']);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", $payload)
        ->assertStatus(422)
        ->assertJsonStructure(['message', 'errors' => [$campo]]);
})->with([
    [['status' => 'AGENDADA', 'data_agendada' => '2026-09-25'], 'hora_agendada'],
    [['status' => 'AGENDADA', 'data_agendada' => '2026-09-25', 'hora_agendada' => '07:00', 'turno' => 'MANHA'], 'turno'],
]);
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
docker compose exec backend ./vendor/bin/pest tests/Feature/AgendamentoTurnoTest.php tests/Feature/AtualizarStatusTest.php tests/Feature/ReagendarSolicitacaoTest.php
```

Expected: FAIL because requests only accept hour and Actions do not create `agendamentos`.

- [ ] **Step 3: Implement `TurnoAgendamento`**

```php
final class TurnoAgendamento
{
    public const TURNOS = ['MANHA', 'TARDE', 'NOITE'];

    public static function derivarDaHora(string $hora): string
    {
        [$h] = array_map('intval', explode(':', $hora));
        return match (true) {
            $h >= 6 && $h < 12 => 'MANHA',
            $h >= 12 && $h < 18 => 'TARDE',
            default => 'NOITE',
        };
    }

    public static function fimDoTurnoUtc(string $data, string $turno, string $timezone): CarbonImmutable
    {
        $base = CarbonImmutable::createFromFormat('!Y-m-d', $data, $timezone);
        $fimLocal = match ($turno) {
            'MANHA' => $base->setTime(12, 0),
            'TARDE' => $base->setTime(18, 0),
            'NOITE' => $base->addDay()->setTime(6, 0),
        };
        return $fimLocal->utc();
    }
}
```

- [ ] **Step 4: Update request validation**

For `AGENDADA`, require `data_agendada` and exactly one of `hora_agendada` or `turno`. Reject fields extras. In a custom `withValidator` callback:

```php
$temHora = $this->filled('hora_agendada');
$temTurno = $this->filled('turno');
if ($this->input('status') === 'AGENDADA' && $temHora === $temTurno) {
    $validator->errors()->add($temHora ? 'turno' : 'hora_agendada', 'Informe horário ou turno, mas não ambos.');
}
```

Keep `hora_agendada` pattern `HH:mm`, `turno` in `MANHA,TARDE,NOITE`, and date future according to operational timezone.

- [ ] **Step 5: Create agendamento rows in Actions**

In `AtualizarStatusSolicitacao`, replace direct-only `agendado_para` logic:

```php
$agendamento = $this->montarAgendamento($requestData);
$solicitacao->update([
    'status' => 'AGENDADA',
    'agendado_para' => $agendamento['modalidade'] === 'HORARIO' ? $agendamento['agendado_para'] : null,
]);

Agendamento::query()->create([
    'solicitacao_id' => $solicitacao->id,
    'data_agendada' => $agendamento['data_agendada'],
    'modalidade' => $agendamento['modalidade'],
    'hora_agendada' => $agendamento['hora_agendada'],
    'turno' => $agendamento['turno'],
    'status' => 'AGENDADO',
]);
```

For hour mode, derive `turno` from `hora_agendada` and set legacy `agendado_para`. For shift mode, set `hora_agendada = null` and legacy `agendado_para = null`.

In `ReagendarSolicitacao`, lock `solicitacao` and `agendamentoAtivo`, update the active row rather than creating a new one; keep idempotency when the derived values are identical.

- [ ] **Step 6: Include active schedule in resource**

Add:

```php
'agendamento_ativo' => new AgendamentoResource($this->whenLoaded('agendamentoAtivo')),
```

`AgendamentoResource` returns `id`, `data_agendada`, `modalidade`, `hora_agendada`, `turno`, `status`, `resultado_em`, `falta_registrada_em`, `falta_corrigida_em`.

- [ ] **Step 7: Run backend agenda tests**

Run:

```powershell
docker compose exec backend ./vendor/bin/pest tests/Feature/AgendamentoTurnoTest.php tests/Feature/AtualizarStatusTest.php tests/Feature/ReagendarSolicitacaoTest.php tests/Feature/ListarSolicitacoesTest.php
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```powershell
git add backend/app/Domain/Solicitacoes/Support/TurnoAgendamento.php backend/app/Domain/Solicitacoes/Http/Requests/AtualizarStatusRequest.php backend/app/Domain/Solicitacoes/Http/Requests/ReagendarSolicitacaoRequest.php backend/app/Domain/Solicitacoes/Actions/AtualizarStatusSolicitacao.php backend/app/Domain/Solicitacoes/Actions/ReagendarSolicitacao.php backend/app/Domain/Solicitacoes/Http/Resources backend/tests/Feature/AgendamentoTurnoTest.php backend/tests/Feature/AtualizarStatusTest.php backend/tests/Feature/ReagendarSolicitacaoTest.php backend/tests/Feature/ListarSolicitacoesTest.php
git commit -m "feat(agenda): suporta agendamento por turno"
```

---

### Task 5: Faltas e Tentativas de Contato Enxutas

**Files:**
- Create: `backend/tests/Feature/FaltasTest.php`
- Create: `backend/app/Domain/Solicitacoes/Actions/RegistrarFaltaAgendamento.php`
- Create: `backend/app/Domain/Solicitacoes/Actions/RegistrarTentativaContato.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Requests/RegistrarTentativaContatoRequest.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Produces: `POST /api/v1/agendamentos/{id}/falta`.
- Produces: `POST /api/v1/agendamentos/{id}/tentativas-contato` with only `resultado`.
- Produces: `GET /api/v1/faltas`.

- [ ] **Step 1: Write failing tests**

Create `FaltasTest.php`:

```php
<?php

use App\Models\Agendamento;
use App\Models\Solicitacao;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('nao registra falta antes do horario exato', function () {
    CarbonImmutable::setTestNow('2026-09-25T09:59:00-03:00');
    $agendamento = Agendamento::factory()->create([
        'status' => 'AGENDADO',
        'modalidade' => 'HORARIO',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '10:00',
        'turno' => 'MANHA',
    ]);

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/falta")->assertStatus(422);
});

test('registra falta apos horario e mantem solicitacao AGENDADA', function () {
    CarbonImmutable::setTestNow('2026-09-25T10:01:00-03:00');
    $solicitacao = Solicitacao::factory()->create(['status' => 'AGENDADA']);
    $agendamento = Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'AGENDADO',
        'modalidade' => 'HORARIO',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '10:00',
        'turno' => 'MANHA',
    ]);

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/falta")->assertOk()
        ->assertJsonPath('data.status', 'FALTA');

    expect($solicitacao->fresh()->status)->toBe('AGENDADA');
});

test('turno so permite falta depois do fim do periodo', function () {
    CarbonImmutable::setTestNow('2026-09-25T11:59:00-03:00');
    $agendamento = Agendamento::factory()->create([
        'status' => 'AGENDADO',
        'modalidade' => 'TURNO',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => null,
        'turno' => 'MANHA',
    ]);

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/falta")->assertStatus(422);

    CarbonImmutable::setTestNow('2026-09-25T12:00:00-03:00');
    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/falta")->assertOk();
});

test('contato aceita apenas resultado fechado em agendamento com falta', function () {
    $agendamento = Agendamento::factory()->create(['status' => 'FALTA']);

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/tentativas-contato", [
        'resultado' => 'SEM_RESPOSTA',
        'observacao' => 'nao deve existir',
    ])->assertStatus(422)->assertJsonStructure(['errors' => ['observacao']]);

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/tentativas-contato", [
        'resultado' => 'SEM_RESPOSTA',
    ])->assertCreated()->assertJsonPath('data.resultado', 'SEM_RESPOSTA');
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
docker compose exec backend ./vendor/bin/pest tests/Feature/FaltasTest.php
```

Expected: FAIL because routes and Actions do not exist.

- [ ] **Step 3: Implement `RegistrarFaltaAgendamento`**

Use transaction:

```php
$agendamento = Agendamento::query()->whereKey($agendamento->id)->lockForUpdate()->firstOrFail();

if ($agendamento->status !== 'AGENDADO') {
    $this->conflito('Somente agendamentos ativos podem receber falta.');
}

$limite = $agendamento->modalidade === 'HORARIO'
    ? HorarioAgendamento::interpretarLocal($agendamento->data_agendada->toDateString(), substr($agendamento->hora_agendada, 0, 5), config('agendamento.timezone'))
    : TurnoAgendamento::fimDoTurnoUtc($agendamento->data_agendada->toDateString(), $agendamento->turno, config('agendamento.timezone'));

if (now()->lt($limite)) {
    throw ValidationException::withMessages(['agendamento' => ['A falta só pode ser registrada após o horário ou fim do turno.']]);
}

$agendamento->update(['status' => 'FALTA', 'falta_registrada_em' => now()]);
```

- [ ] **Step 4: Implement minimal contact Action and Request**

`RegistrarTentativaContatoRequest` rules:

```php
'resultado' => ['required', Rule::in(['SEM_RESPOSTA', 'RECADO', 'CONFIRMOU_RETORNO', 'NUMERO_INVALIDO'])],
```

Reject unknown fields using the project’s existing request pattern. Do not add `canal`, `observacao`, `justificativa` or text columns.

Action:

```php
$agendamento = Agendamento::query()->whereKey($agendamento->id)->lockForUpdate()->firstOrFail();
if ($agendamento->status !== 'FALTA') {
    $this->conflito('Tentativas de contato só podem ser registradas após falta.');
}
return $agendamento->tentativasContato()->create([
    'resultado' => $resultado,
    'realizada_em' => now(),
]);
```

- [ ] **Step 5: Implement `/faltas` list**

`ListarFaltasRequest` accepts `data`, `resultado_contato`, `page`, `per_page`. Query `Agendamento::where('status', 'FALTA')`, eager load `solicitacao.paciente` and `ultimaTentativaContato`, sort by `falta_registrada_em desc`, paginate and return `AgendamentoResource::collection()`.

- [ ] **Step 6: Run tests**

Run:

```powershell
docker compose exec backend ./vendor/bin/pest tests/Feature/FaltasTest.php
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add backend/tests/Feature/FaltasTest.php backend/app/Domain/Solicitacoes/Actions/RegistrarFaltaAgendamento.php backend/app/Domain/Solicitacoes/Actions/RegistrarTentativaContato.php backend/app/Domain/Solicitacoes/Http/Requests/RegistrarTentativaContatoRequest.php backend/app/Domain/Solicitacoes/Http/Requests/ListarFaltasRequest.php backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php backend/routes/api.php
git commit -m "feat(faltas): registra ausencia e contato enxuto"
```

---

### Task 6: Reagendamento Após Falta e Correção por Conclusão

**Files:**
- Create: `backend/tests/Feature/ReagendarAposFaltaTest.php`
- Create: `backend/app/Domain/Solicitacoes/Actions/ReagendarAposFalta.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Requests/ReagendarAposFaltaRequest.php`
- Modify: `backend/app/Domain/Solicitacoes/Actions/AtualizarStatusSolicitacao.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Produces: `POST /api/v1/agendamentos/{id}/reagendar-apos-falta`.
- Produces: `AGENDADA -> CONCLUIDA` corrects active or missing appointment without deleting history.

- [ ] **Step 1: Write failing tests**

Create `ReagendarAposFaltaTest.php`:

```php
<?php

use App\Models\Agendamento;
use App\Models\Solicitacao;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('reagendar apos falta cria novo ativo e preserva falta antiga', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'AGENDADA']);
    $falta = Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'FALTA',
        'modalidade' => 'TURNO',
        'data_agendada' => '2026-09-25',
        'turno' => 'MANHA',
        'hora_agendada' => null,
        'falta_registrada_em' => now(),
    ]);

    $this->postJson("/api/v1/agendamentos/{$falta->id}/reagendar-apos-falta", [
        'data_agendada' => '2026-09-30',
        'hora_agendada' => '14:00',
    ])->assertCreated()
        ->assertJsonPath('data.status', 'AGENDADO')
        ->assertJsonPath('data.turno', 'TARDE');

    expect($falta->fresh()->status)->toBe('FALTA')
        ->and(Agendamento::where('solicitacao_id', $solicitacao->id)->where('status', 'AGENDADO')->count())->toBe(1);
});

test('nao reagenda agendamento que nao esta em falta', function () {
    $agendamento = Agendamento::factory()->create(['status' => 'AGENDADO']);

    $this->postJson("/api/v1/agendamentos/{$agendamento->id}/reagendar-apos-falta", [
        'data_agendada' => '2026-09-30',
        'turno' => 'TARDE',
    ])->assertStatus(409);
});

test('concluir depois de falta preserva registro e preenche correcao', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'AGENDADA']);
    $falta = Agendamento::factory()->create([
        'solicitacao_id' => $solicitacao->id,
        'status' => 'FALTA',
        'falta_registrada_em' => now()->subHour(),
    ]);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", ['status' => 'CONCLUIDA'])->assertOk();

    expect($falta->fresh()->status)->toBe('REALIZADO')
        ->and($falta->fresh()->falta_registrada_em)->not->toBeNull()
        ->and($falta->fresh()->falta_corrigida_em)->not->toBeNull();
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
docker compose exec backend ./vendor/bin/pest tests/Feature/ReagendarAposFaltaTest.php
```

Expected: FAIL because endpoint and correction behavior do not exist.

- [ ] **Step 3: Implement `ReagendarAposFalta`**

Inside transaction:

```php
$falta = Agendamento::query()->whereKey($agendamento->id)->lockForUpdate()->firstOrFail();
if ($falta->status !== 'FALTA') {
    $this->conflito('Somente faltas podem ser reagendadas por esta rota.');
}

$solicitacao = Solicitacao::query()->whereKey($falta->solicitacao_id)->lockForUpdate()->firstOrFail();
if ($solicitacao->status !== 'AGENDADA') {
    $this->conflito('A solicitação precisa permanecer agendada para receber novo agendamento.');
}

if (Agendamento::query()->where('solicitacao_id', $solicitacao->id)->where('status', 'AGENDADO')->lockForUpdate()->exists()) {
    $this->conflito('Já existe um agendamento ativo para esta solicitação.');
}
```

Create new `AGENDADO` from hour or turn payload. Update `solicitacoes.agendado_para` only for hour mode; set null for turn mode.

- [ ] **Step 4: Correct missing appointment on conclusion**

In `AtualizarStatusSolicitacao`, when `$novoStatus === 'CONCLUIDA'`:

```php
$agendamento = Agendamento::query()
    ->where('solicitacao_id', $solicitacao->id)
    ->whereIn('status', ['AGENDADO', 'FALTA'])
    ->latest('id')
    ->lockForUpdate()
    ->first();

if ($agendamento !== null) {
    $agendamento->update([
        'status' => 'REALIZADO',
        'resultado_em' => now(),
        'falta_corrigida_em' => $agendamento->status === 'FALTA' ? now() : $agendamento->falta_corrigida_em,
    ]);
}
```

When `$novoStatus === 'CANCELADA'`, cancel active `AGENDADO`; keep old `FALTA` rows unchanged.

- [ ] **Step 5: Wire route and resource**

Add route:

```php
Route::post('/agendamentos/{agendamento}/reagendar-apos-falta', [SolicitacaoController::class, 'reagendarAposFalta']);
```

Return `new AgendamentoResource($novoAgendamento->load('solicitacao.paciente'))` with status 201.

- [ ] **Step 6: Run tests**

Run:

```powershell
docker compose exec backend ./vendor/bin/pest tests/Feature/ReagendarAposFaltaTest.php tests/Feature/AtualizarStatusTest.php tests/Feature/FaltasTest.php
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add backend/tests/Feature/ReagendarAposFaltaTest.php backend/app/Domain/Solicitacoes/Actions/ReagendarAposFalta.php backend/app/Domain/Solicitacoes/Http/Requests/ReagendarAposFaltaRequest.php backend/app/Domain/Solicitacoes/Actions/AtualizarStatusSolicitacao.php backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php backend/routes/api.php
git commit -m "feat(faltas): permite reagendamento apos ausencia"
```

---

### Task 7: Frontend Tipado, Formulário de Turno e Aba Faltas

**Files:**
- Modify: `frontend/src/features/solicitacoes/types/index.ts`
- Modify: `frontend/src/features/solicitacoes/api/client.ts`
- Modify: `frontend/src/features/solicitacoes/components/SolicitacaoForm.tsx`
- Modify: `frontend/src/features/solicitacoes/components/AgendamentoForm.tsx`
- Create: `frontend/src/features/solicitacoes/components/GrupoTurnoAgenda.tsx`
- Create: `frontend/src/features/solicitacoes/components/FaltaCard.tsx`
- Create: `frontend/src/features/solicitacoes/components/ContatoFaltaDialog.tsx`
- Modify: `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx`
- Modify: `frontend/src/features/solicitacoes/pages/SolicitacaoDetailPage.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/test/agendamento-turno.test.tsx`, `frontend/src/test/faltas.test.tsx`, existing frontend tests.

**Interfaces:**
- Consumes backend routes from Tasks 3 to 6.
- Produces view `?visao=faltas`.
- Produces `AgendamentoPayload = {data_agendada, hora_agendada} | {data_agendada, turno}`.

- [ ] **Step 1: Write failing frontend tests for schedule modes**

Create `frontend/src/test/agendamento-turno.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AgendamentoForm } from '../features/solicitacoes/components/AgendamentoForm';

describe('AgendamentoForm com horario ou turno', () => {
  it('deriva Manha quando horario e 07:00', async () => {
    const onSubmit = vi.fn();
    render(<AgendamentoForm onSubmit={onSubmit} onCancel={vi.fn()} submitLabel="Salvar" />);
    await userEvent.click(screen.getByRole('radio', { name: 'Horário exato' }));
    await userEvent.type(screen.getByLabelText('Data do atendimento'), '2026-09-25');
    await userEvent.type(screen.getByLabelText('Horário do atendimento'), '07:00');
    expect(screen.getByText('Turno: Manhã')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSubmit).toHaveBeenCalledWith({ data_agendada: '2026-09-25', hora_agendada: '07:00' });
  });

  it('envia turno sem hora', async () => {
    const onSubmit = vi.fn();
    render(<AgendamentoForm onSubmit={onSubmit} onCancel={vi.fn()} submitLabel="Salvar" />);
    await userEvent.click(screen.getByRole('radio', { name: 'Turno' }));
    await userEvent.type(screen.getByLabelText('Data do atendimento'), '2026-09-25');
    await userEvent.selectOptions(screen.getByLabelText('Turno do atendimento'), 'TARDE');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSubmit).toHaveBeenCalledWith({ data_agendada: '2026-09-25', turno: 'TARDE' });
  });
});
```

- [ ] **Step 2: Write failing frontend tests for Faltas**

Create `frontend/src/test/faltas.test.tsx`:

```tsx
it('abre aba Faltas e registra contato com quatro opcoes fechadas', async () => {
  vi.mocked(solicitacoesApi.listarFaltas).mockResolvedValue({
    data: [{
      id: 10,
      data_agendada: '2026-09-25',
      modalidade: 'TURNO',
      hora_agendada: null,
      turno: 'MANHA',
      status: 'FALTA',
      falta_registrada_em: '2026-09-25T15:00:00Z',
      solicitacao: {
        id: 1,
        protocolo: 'SOL-2026-0001',
        nome_solicitante: 'Maria da Silva',
        paciente: { id: 1, nome: 'Maria da Silva', celular_mascarado: '(81) *****-0000' },
      },
      ultima_tentativa_contato: null,
    }],
    meta: { total: 1, per_page: 10, current_page: 1, last_page: 1 },
    links: { first: null, last: null, next: null, prev: null },
  });

  render(<MemoryRouter initialEntries={['/?visao=faltas']}><Routes><Route path="/" element={<SolicitacoesPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Faltas' })).toBeInTheDocument();
  expect(screen.getByText('(81) *****-0000')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Registrar contato' }));
  expect(screen.getByRole('radio', { name: 'Sem resposta' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Recado deixado' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Confirmou retorno' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Número inválido' })).toBeInTheDocument();
  expect(screen.queryByLabelText(/observ/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run frontend tests and confirm RED**

Run:

```powershell
Set-Location frontend
npm run test -- --run src/test/agendamento-turno.test.tsx src/test/faltas.test.tsx
Set-Location ..
```

Expected: FAIL because components and API methods do not exist.

- [ ] **Step 4: Update TypeScript contracts and API client**

Add types:

```ts
export type Turno = 'MANHA' | 'TARDE' | 'NOITE';
export type ModalidadeAgendamento = 'HORARIO' | 'TURNO';
export type StatusAgendamento = 'AGENDADO' | 'REALIZADO' | 'FALTA' | 'CANCELADO';
export type ResultadoContato = 'SEM_RESPOSTA' | 'RECADO' | 'CONFIRMOU_RETORNO' | 'NUMERO_INVALIDO';

export type AgendamentoPayload =
  | { data_agendada: string; hora_agendada: string; turno?: never }
  | { data_agendada: string; turno: Turno; hora_agendada?: never };
```

Add `Agendamento`, `TentativaContato`, `PacienteResumo`, `FaltaListItem`, and client methods:

```ts
listarFila(filtros)
listarFaltas(filtros)
registrarFalta(agendamentoId)
registrarContato(agendamentoId, { resultado })
reagendarAposFalta(agendamentoId, payload)
```

- [ ] **Step 5: Update `AgendamentoForm`**

Add a `fieldset` with two radios: `Horário exato` and `Turno`. Hour mode shows date and hour input plus readonly text `Turno: Manhã/Tarde/Noite`. Turn mode shows date and select. Disable submit while pending. Keep visible labels and field errors.

- [ ] **Step 6: Implement agenda grouping and Faltas view**

`GrupoTurnoAgenda` receives `turno`, `agendamentos`, and renders exact times sorted before turn-only items. `FaltaCard` renders only name, protocol, date/time or shift, masked phone, last contact and buttons `Registrar contato` and `Reagendar`. `ContatoFaltaDialog` contains only four radios and save/cancel.

In `SolicitacoesPage`, support `visao=faltas`, call `listarFaltas`, show empty text `Nenhuma falta pendente`, and preserve URL/back-forward behavior.

- [ ] **Step 7: Run frontend verification**

Run:

```powershell
Set-Location frontend
npm run test -- --run
npx tsc --noEmit
npm run lint
npm run build
Set-Location ..
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```powershell
git add frontend/src/features/solicitacoes frontend/src/test frontend/src/index.css
git commit -m "feat(frontend): adiciona agenda por turno e faltas"
```

---

### Task 8: Documentação, Verificação Integrada e Handoff

**Files:**
- Modify: `docs/spec.md`
- Modify: `docs/openapi.yaml`
- Modify: `docs/architecture.md`
- Modify: `docs/codebase-map.md`
- Modify: `README.md`
- Modify: `TASKS.md`
- Rewrite: `HANDOFF.md`

**Interfaces:**
- Consumes: all implemented backend and frontend contracts.
- Produces: evaluator-ready documentation and final evidence.

- [x] **Step 1: Update `docs/spec.md`**

Add sections for `pacientes`, `entradas_fila`, `agendamentos`, `tentativas_contato`, `/fila`, `/faltas`, `/agendamentos/{id}/falta`, `/tentativas-contato`, `/reagendar-apos-falta`, hour-or-turn payload, lack of `FALTA` in `solicitacoes.status`, and `agendado_para` as compatibility field.

- [x] **Step 2: Update OpenAPI**

Document schemas:

```yaml
AgendamentoPayload:
  oneOf:
    - required: [data_agendada, hora_agendada]
    - required: [data_agendada, turno]
  additionalProperties: false
```

Document routes and examples for 200/201, 409 and 422. Include that contact payload is only:

```json
{ "resultado": "SEM_RESPOSTA" }
```

- [x] **Step 3: Update architecture, map and README**

`docs/architecture.md` must explain why falta is appointment status, not request status. `docs/codebase-map.md` must point to new Actions, Resources, frontend components and tests. `README.md` must include examples for creating with optional phone, entering queue, scheduling by hour, scheduling by shift, marking absence, registering contact and rebooking.

- [~] **Step 4: Run complete backend verification** (parcial)

Run:

```powershell
docker compose exec backend ./vendor/bin/pint --test
docker compose exec backend ./vendor/bin/pest
```

Expected: all pass. Record exact test counts in `HANDOFF.md`.

Status: rodado pelo usuário na própria máquina para o conjunto original da Task 1–7 (confirmado
"todos os testes passaram", sem contagem exata anotada). Os 2 testes novos de `AgendamentoTurnoTest.php`
adicionados durante a revisão de turno (2026-09-22) **ainda não foram executados** — este ambiente
de sandbox não tem PHP/Docker. Pendente: rodar `php artisan test` (ou os comandos acima) na máquina
com Docker e registrar o resultado em `HANDOFF.md`.

- [x] **Step 5: Run complete frontend verification**

Run:

```powershell
Set-Location frontend
npm run test -- --run
npx tsc --noEmit
npm run lint
npm run build
Set-Location ..
```

Expected: all pass. Record exact counts and warnings in `HANDOFF.md`.

- [ ] **Step 6: Run integrated API smoke** — pendente (precisa da stack Docker rodando; não disponível neste sandbox)

Use fictitious data only. Exercise create, `EM_ANALISE`, schedule by hour, list `/fila`, list agenda day, mark absence after an eligible past slot, register contact, rebook after absence, and conclude. Confirm request status never becomes `FALTA`.

- [ ] **Step 7: Run visual and accessibility check** — pendente (precisa do frontend rodando em navegador real; não disponível neste sandbox)

In browser against the running Docker frontend, check 320 px, 375 px, 768 px, 1024 px and desktop. Verify no horizontal overflow, tabs wrap, Faltas cards have only the allowed fields, dialog focus stays trapped, radios have labels, and actions are at least 44 px high.

- [ ] **Step 8: Update Graphify** — pendente (`graphify` não está instalado neste sandbox; `graphify-out/` existente é de 2026-09-18/21, anterior aos commits desta rodada)

Run:

```powershell
& "$env:APPDATA\Python\Python312\Scripts\graphify.exe" update .
```

Expected: update completes. Do not commit `graphify-out` if it is ignored or derived.

- [x] **Step 9: Update task tracking**

Add a completed line to `TASKS.md` only after verification passes:

```markdown
- [x] Pacientes, fila contínua, agenda por horário/turno e faltas: separa paciente, fila e agendamentos; falta fica no histórico do agendamento, contato é enxuto e reagendamento preserva a ausência original. Evidência: <comandos e contagens reais>.
```

Rewrite `HANDOFF.md` with:

- last completed task;
- commits created;
- exact verification results;
- known unrelated dirty files;
- next task;
- blockers, if any.

- [x] **Step 10: Commit documentation** (em mais de um commit — ver nota abaixo)

Run:

```powershell
git add docs/spec.md docs/openapi.yaml docs/architecture.md docs/codebase-map.md README.md TASKS.md HANDOFF.md
git commit -m "docs: consolida pacientes fila agenda e faltas"
```

Feito como `b6ae131` (`docs: consolida pacientes fila agenda e faltas`, commit original da Task 8) mais
dois commits de acompanhamento que corrigiram/complementaram a mesma documentação depois de achados
posteriores: `743c65b` (correção da descrição de `turno`, encontrada na revisão profunda de agenda por
turno) e `c34814a` (nota sobre as mensagens "esperando"/"agendado para"/"em atraso" do painel).
`TASKS.md`/`HANDOFF.md` continuam fora do git (gitignored) e foram atualizados localmente a cada rodada.

## Final Acceptance Checklist

Itens 1–15: implementados e cobertos por teste de feature dedicado (nomeado abaixo); evidência de
execução é o Pest/Pint que o usuário confirmou ter passado por completo na própria máquina (sem
contagem exata anotada) — não foram reexecutados neste sandbox (sem PHP/Docker aqui), exceto onde
indicado.

- [x] `solicitacoes.status` never stores `FALTA`. — por design: só `AtualizarStatusSolicitacao` escreve `solicitacoes.status`, e `FALTA` só existe em `agendamentos.status` (`RegistrarFaltaAgendamento`).
- [x] `AtualizarStatusSolicitacao` remains the only Action changing request status. — confirmado por revisão de código; `ReagendarSolicitacao`, `ReagendarAposFalta`, `RegistrarFaltaAgendamento` e `RegistrarTentativaContato` só tocam `Agendamento`/`TentativaContato`.
- [x] New request with existing CPF reuses patient. — `PacienteSolicitacaoTest`.
- [x] Existing CPF with different birth date returns 422. — `PacienteSolicitacaoTest`.
- [x] `RECEBIDA -> EM_ANALISE` opens queue entry. — `FilaOperacionalTest`.
- [x] `EM_ANALISE -> AGENDADA` closes queue entry and creates active appointment. — `FilaOperacionalTest`, `AgendamentoTurnoTest`.
- [x] Hour mode derives `MANHA`, `TARDE`, or `NOITE`. — `AgendamentoTurnoTest` (mais o teste novo `'AGENDADA por horario deriva e persiste o turno automaticamente'`, adicionado na revisão de 2026-09-22 e **ainda não executado** neste sandbox).
- [x] Shift mode stores no artificial time and leaves `agendado_para = null`. — `AgendamentoTurnoTest`.
- [x] `GET /fila` is server ordered by priority and oldest entry. — `FilaOperacionalTest`.
- [x] `GET /faltas` exposes masked phone, last contact and next action data. — `FaltasTest`.
- [x] Contact form has only four closed results and no notes. — `FaltasTest` (backend); `ContatoFaltaDialog.tsx` (frontend, sem campo de texto livre).
- [x] Absence before exact time or before shift end returns 422. — `FaltasTest`.
- [x] Rebooking after absence creates a new active appointment and preserves the old `FALTA`. — `ReagendarAposFaltaTest`.
- [x] Concluding after mistaken absence preserves `falta_registrada_em` and fills `falta_corrigida_em`. — `ReagendarAposFaltaTest`.
- [x] Frontend URL supports `fila`, `agenda`, `faltas`, `historico` with back/forward. — `agenda.test.tsx`, `solicitacoes.test.tsx`.
- [~] Pest, Pint, Vitest, TypeScript, ESLint, build, smoke test, visual check and Graphify have evidence in `HANDOFF.md`. — **parcial**:
  - Vitest, `tsc --noEmit`, ESLint e `vite build`: ✅ executados neste sandbox repetidas vezes, evidência em `HANDOFF.md`.
  - Pest/Pint: ✅ confirmado pelo usuário para o conjunto original (Task 1–7), sem contagem exata; ❌ os 2 testes novos de `AgendamentoTurnoTest.php` da revisão de turno ainda não rodaram.
  - Smoke test integrado de API: ❌ não executado nesta rodada (precisa da stack Docker; feito anteriormente para uma versão anterior do agendamento, não para pacientes/fila/faltas completos).
  - Verificação visual/acessibilidade (320px–desktop): ❌ não feita em navegador real.
  - Graphify: ❌ não roda neste sandbox; `graphify-out/` existente é de 2026-09-18/21, anterior aos commits desta rodada (`36fdddb` em diante).

  Pendências para fechar este item, todas na máquina do usuário: rodar Pest completo (com foco nos 2
  testes novos), o smoke test de API, a checagem visual e `graphify update .`; registrar os resultados
  em `HANDOFF.md`.
