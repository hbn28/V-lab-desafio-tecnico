# Agenda de Solicitações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir agendar e reagendar solicitações com data e hora obrigatórias, consultar uma agenda diária e aceitar múltiplas solicitações no mesmo horário sem alterar a máquina de estados do desafio.

**Architecture:** O agendamento inicial continua sendo a transição `EM_ANALISE → AGENDADA` dentro de `AtualizarStatusSolicitacao`; um endpoint separado altera apenas a data/hora de solicitações já agendadas. O PostgreSQL protege as invariantes, o backend interpreta horários em `America/Recife` e persiste UTC, e o frontend acrescenta um formulário focado e uma terceira visão diária na tela principal.

**Tech Stack:** PHP 8.3, Laravel 11, Pest 3, PostgreSQL 16, React 18, TypeScript 5.6, Vite 5, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-21-agendamento-solicitacoes-design.md`

## Global Constraints

- Preservar exatamente os estados `RECEBIDA`, `EM_ANALISE`, `AGENDADA`, `CONCLUIDA` e `CANCELADA` e as transições atuais.
- `AtualizarStatusSolicitacao` permanece a única Action autorizada a mudar `status`.
- Data e hora são obrigatórias para entrar em `AGENDADA` e para reagendar.
- Horários iguais são permitidos; não criar constraint única nem consulta de disponibilidade.
- Toda mutação usa `DB::transaction` e relê a linha com `lockForUpdate`.
- Persistir `agendado_para` como `TIMESTAMP WITH TIME ZONE` em UTC; interpretar e exibir no fuso configurado, padrão `America/Recife`.
- Usar 422 para entrada inválida, 409 para estado/transição incompatível e o envelope `{ message, errors }`.
- Reutilizar os tokens e componentes visuais atuais, manter controles com pelo menos 44 px e cobrir carregamento, sucesso, vazio e erro.
- Testes de constraints, transações e locks usam PostgreSQL 16; testes de frontend mockam o cliente HTTP.
- Não adicionar Repository, DTO, CQRS, Event Sourcing, capacidade por horário, check-in, prioridade clínica automática ou CI.
- Alterações de comportamento seguem RED → GREEN → REFACTOR e cada tarefa termina com um commit próprio.

## Review Focus

- Horário local inexistente ou ambíguo por mudança de offset deve retornar 422, sem normalização silenciosa; coberto na Task 1 e consumido nas Tasks 2 e 3.
- Uma requisição atrasada baseada em um objeto `EM_ANALISE` já agendado por outra requisição deve reler o estado bloqueado e retornar 409; coberto na Task 2.
- `data_agendada` combinada com status incompatível ou `status_grupo=encerrado` deve retornar 422 em vez de uma agenda vazia enganosa; coberto na Task 4.
- Uma resposta 409 durante a edição no frontend deve preservar os valores, recarregar a solicitação e explicar que o estado mudou; coberto na Task 6.
- A data selecionada na agenda deve permanecer estável após a montagem, inclusive quando `Date.now()` atravessar a meia-noite; coberto na Task 7.

---

## Preflight obrigatório

Antes da Task 1, confirmar que a base atual está verde. O `HANDOFF.md` registra uma correção de fixtures cuja suíte completa ainda precisava de evidência.

```powershell
docker compose up -d
docker compose exec backend ./vendor/bin/pest
Set-Location frontend
npm run test -- --run
npm run lint
npm run build
Set-Location ..
```

Resultado exigido: todos os comandos com exit code 0. Se a base falhar por motivo não relacionado à agenda, parar este plano e usar `superpowers:systematic-debugging`; não misturar a correção no primeiro commit da feature.

## File Structure

### Backend

- `backend/config/agendamento.php`: fuso operacional único do backend.
- `backend/app/Domain/Solicitacoes/Support/HorarioAgendamento.php`: conversão estrita de data/hora local para UTC e limites UTC de um dia local.
- `backend/database/migrations/2026_09_21_000003_add_agendado_para_to_solicitacoes_table.php`: coluna, índice, saneamento legado e constraints.
- `backend/app/Domain/Solicitacoes/Actions/AtualizarStatusSolicitacao.php`: transição atômica com agendamento inicial.
- `backend/app/Domain/Solicitacoes/Actions/ReagendarSolicitacao.php`: alteração bloqueada somente de `agendado_para`.
- `backend/app/Domain/Solicitacoes/Http/Requests/AtualizarStatusRequest.php`: payload condicional do agendamento inicial.
- `backend/app/Domain/Solicitacoes/Http/Requests/ReagendarSolicitacaoRequest.php`: payload obrigatório do reagendamento.
- `backend/app/Domain/Solicitacoes/Http/Requests/ListarSolicitacoesRequest.php`: validação do filtro diário.
- `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php`: orquestra as Actions e a consulta diária.
- `backend/app/Domain/Solicitacoes/Http/Resources/SolicitacaoResource.php`: expõe `agendado_para` em UTC.
- `backend/app/Models/Solicitacao.php`: fillable e cast do novo campo.
- `backend/routes/api.php`: rota de reagendamento.
- `backend/tests/Unit/HorarioAgendamentoTest.php`: horários estritos e transições de offset.
- `backend/tests/Feature/AgendamentoConstraintsTest.php`: invariantes PostgreSQL.
- `backend/tests/Feature/AtualizarStatusTest.php`: agendamento inicial e concorrência por estado relido.
- `backend/tests/Feature/ReagendarSolicitacaoTest.php`: regras e serialização do reagendamento.
- `backend/tests/Feature/ListarSolicitacoesTest.php`: intervalo, compatibilidade e ordenação da agenda.

### Frontend

- `frontend/src/vite-env.d.ts`: tipo da variável de fuso.
- `frontend/src/features/solicitacoes/config/agendamento.ts`: formatação e extração de campos no fuso operacional.
- `frontend/src/features/solicitacoes/types/index.ts`: contratos de payload, resposta e filtro.
- `frontend/src/features/solicitacoes/api/client.ts`: envio do agendamento e reagendamento.
- `frontend/src/features/solicitacoes/components/AgendamentoForm.tsx`: formulário acessível reutilizado nos dois fluxos.
- `frontend/src/features/solicitacoes/pages/SolicitacaoDetailPage.tsx`: integração do agendamento e reagendamento.
- `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx`: visão diária e URL.
- `frontend/src/features/solicitacoes/hooks/useSolicitacoes.ts`: renomeia o conceito de próxima solicitação.
- `frontend/src/index.css`: layout do formulário e da agenda usando tokens existentes.
- `frontend/src/test/agendamento-form.test.tsx`: validação e acessibilidade do componente.
- `frontend/src/test/agendamento-detalhe.test.tsx`: fluxos da página de detalhe.
- `frontend/src/test/agenda.test.tsx`: navegação, consulta, estados e estabilidade da data.
- `frontend/src/test/solicitacoes.test.tsx`: atualiza fixtures e nomenclatura existentes.

### Configuração e documentação

- `backend/.env.example`, `frontend/.env.example` e `docker-compose.yml`: fuso espelhado.
- `backend/database/factories/SolicitacaoFactory.php` e `backend/database/seeders/SolicitacoesSeeder.php`: dados coerentes com constraints.
- `docs/spec.md`, `docs/openapi.yaml`, `docs/architecture.md`, `docs/codebase-map.md` e `README.md`: contrato e operação.
- `TASKS.md` e `HANDOFF.md`: evidência final e continuidade.

---

### Task 1: Persistência, fuso e invariantes de agendamento

**Files:**
- Create: `backend/config/agendamento.php`
- Create: `backend/app/Domain/Solicitacoes/Support/HorarioAgendamento.php`
- Create: `backend/database/migrations/2026_09_21_000003_add_agendado_para_to_solicitacoes_table.php`
- Create: `backend/tests/Unit/HorarioAgendamentoTest.php`
- Create: `backend/tests/Feature/AgendamentoConstraintsTest.php`
- Modify: `backend/tests/Feature/CriarSolicitacaoTest.php`
- Modify: `backend/app/Models/Solicitacao.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Resources/SolicitacaoResource.php`
- Modify: `backend/database/factories/SolicitacaoFactory.php`
- Modify: `backend/database/seeders/SolicitacoesSeeder.php`
- Modify: `backend/.env.example`
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: `HorarioAgendamento::interpretarLocal(string $data, string $hora, string $timezone): ?CarbonImmutable`.
- Produces: `HorarioAgendamento::limitesUtcDoDia(string $data, string $timezone): array{0: CarbonImmutable, 1: CarbonImmutable}`.
- Produces: `Solicitacao::$agendado_para` como `CarbonImmutable|null`.

- [ ] **Step 1: Escrever testes falhos da conversão estrita e dos limites diários**

```php
<?php

use App\Domain\Solicitacoes\Support\HorarioAgendamento;

test('interpreta horário do Recife e devolve UTC', function () {
    $instante = HorarioAgendamento::interpretarLocal('2026-09-25', '14:30', 'America/Recife');
    expect($instante?->toIso8601String())->toBe('2026-09-25T17:30:00+00:00');
});

test('rejeita horário local inexistente ou ambíguo', function (string $data, string $hora) {
    expect(HorarioAgendamento::interpretarLocal($data, $hora, 'America/New_York'))->toBeNull();
})->with([
    ['2026-03-08', '02:30'],
    ['2026-11-01', '01:30'],
]);

test('calcula intervalo UTC semiaberto do dia operacional', function () {
    [$inicio, $fim] = HorarioAgendamento::limitesUtcDoDia('2026-09-25', 'America/Recife');
    expect($inicio->toIso8601String())->toBe('2026-09-25T03:00:00+00:00')
        ->and($fim->toIso8601String())->toBe('2026-09-26T03:00:00+00:00');
});
```

- [ ] **Step 2: Rodar os testes unitários e confirmar RED**

Run: `docker compose exec backend ./vendor/bin/pest tests/Unit/HorarioAgendamentoTest.php`

Expected: FAIL porque `HorarioAgendamento` ainda não existe.

- [ ] **Step 3: Implementar a conversão sem normalização silenciosa**

Criar `HorarioAgendamento` como classe final. Interpretar a entrada como relógio de parede em UTC, coletar os offsets possíveis nas transições do fuso em uma janela de 48 horas e aceitar somente quando exatamente um instante volta a formatar como a entrada original.

```php
public static function interpretarLocal(string $data, string $hora, string $timezone): ?CarbonImmutable
{
    $zona = new DateTimeZone($timezone);
    $parede = CarbonImmutable::createFromFormat('!Y-m-d H:i', "$data $hora", 'UTC');

    if ($parede === false || $parede->format('Y-m-d H:i') !== "$data $hora") {
        return null;
    }

    $offsets = collect($zona->getTransitions($parede->timestamp - 86400, $parede->timestamp + 86400))
        ->pluck('offset')->unique()->values();

    $candidatos = $offsets->map(
        fn (int $offset) => CarbonImmutable::createFromTimestamp($parede->timestamp - $offset, 'UTC')
    )->filter(
        fn (CarbonImmutable $instante) => $instante->setTimezone($zona)->format('Y-m-d H:i') === "$data $hora"
    )->unique(fn (CarbonImmutable $instante) => $instante->timestamp)->values();

    return $candidatos->count() === 1 ? $candidatos->first()->utc() : null;
}

public static function limitesUtcDoDia(string $data, string $timezone): array
{
    $inicioLocal = CarbonImmutable::createFromFormat('!Y-m-d', $data, $timezone)->startOfDay();
    return [$inicioLocal->utc(), $inicioLocal->addDay()->utc()];
}
```

Criar `config/agendamento.php` retornando `['timezone' => env('AGENDAMENTO_TIMEZONE', 'America/Recife')]`.

- [ ] **Step 4: Confirmar GREEN da conversão**

Run: `docker compose exec backend ./vendor/bin/pest tests/Unit/HorarioAgendamentoTest.php`

Expected: PASS com 4 casos.

- [ ] **Step 5: Escrever testes falhos das constraints PostgreSQL**

```php
use App\Models\Solicitacao;
use Illuminate\Database\QueryException;

test('banco rejeita AGENDADA sem data e EM_ANALISE com data', function () {
    expect(fn () => Solicitacao::factory()->create([
        'status' => 'AGENDADA',
        'agendado_para' => null,
    ]))->toThrow(QueryException::class);

    expect(fn () => Solicitacao::factory()->create([
        'status' => 'EM_ANALISE',
        'agendado_para' => '2026-09-25 17:30:00+00',
    ]))->toThrow(QueryException::class);
});

test('banco aceita duas solicitações no mesmo horário', function () {
    $data = ['status' => 'AGENDADA', 'agendado_para' => '2026-09-25 17:30:00+00'];
    Solicitacao::factory()->count(2)->create($data);
    expect(Solicitacao::where('agendado_para', $data['agendado_para'])->count())->toBe(2);
});

test('estados terminais legados aceitam horário nulo', function (string $status) {
    $solicitacao = Solicitacao::factory()->create([
        'status' => $status,
        'agendado_para' => null,
    ]);
    expect($solicitacao->exists)->toBeTrue();
})->with(['CONCLUIDA', 'CANCELADA']);

test('migration devolve AGENDADA legada para EM_ANALISE sem inventar horário', function () {
    $migration = require database_path('migrations/2026_09_21_000003_add_agendado_para_to_solicitacoes_table.php');
    $migration->down();
    $legada = Solicitacao::factory()->create(['status' => 'AGENDADA']);
    $migration->up();
    expect($legada->fresh()->status)->toBe('EM_ANALISE')
        ->and($legada->fresh()->agendado_para)->toBeNull();
});
```

- [ ] **Step 6: Rodar as constraints e confirmar RED**

Run: `docker compose exec backend ./vendor/bin/pest tests/Feature/AgendamentoConstraintsTest.php`

Expected: FAIL porque coluna e constraints não existem.

- [ ] **Step 7: Implementar migration, model, resource e fixtures**

Na migration, executar nesta ordem:

```php
Schema::table('solicitacoes', function (Blueprint $table) {
    $table->timestampTz('agendado_para')->nullable()->index();
});

DB::table('solicitacoes')->where('status', 'AGENDADA')->update([
    'status' => 'EM_ANALISE',
    'agendado_para' => null,
]);

DB::statement("ALTER TABLE solicitacoes ADD CONSTRAINT chk_agendada_com_horario CHECK (status <> 'AGENDADA' OR agendado_para IS NOT NULL)");
DB::statement("ALTER TABLE solicitacoes ADD CONSTRAINT chk_estado_inicial_sem_horario CHECK (status NOT IN ('RECEBIDA','EM_ANALISE') OR agendado_para IS NULL)");
```

No `down()`, remover as duas constraints antes do índice e da coluna. Adicionar `agendado_para` ao `$fillable`, cast `immutable_datetime` e serialização UTC anulável no Resource:

```php
'agendado_para' => $this->agendado_para?->utc()->toIso8601String(),
```

Factory: adicionar `'agendado_para' => null` ao estado padrão `RECEBIDA`; testes e consumidores que sobrescreverem `status` para `AGENDADA` também devem sobrescrever o instante. Seeder: calcular `$amanha = now(config('agendamento.timezone'))->addDay()->setTime(9, 0)->utc()` e `$depois = now(config('agendamento.timezone'))->addDays(2)->setTime(14, 30)->utc()`, atribuindo-os aos protocolos `SOL-2025-0003` e `SOL-2025-0008`. Os demais fixtures recebem `null`, preservando idempotência por protocolo.

Em `CriarSolicitacaoTest.php`, ampliar o teste feliz com `->assertJsonPath('data.agendado_para', null)` e `assertDatabaseHas('solicitacoes', ['id' => $response->json('data.id'), 'agendado_para' => null])`. Isso fixa que criação continua em `RECEBIDA` sem agenda.

- [ ] **Step 8: Configurar o fuso e confirmar GREEN da persistência**

Adicionar `AGENDAMENTO_TIMEZONE=America/Recife` ao backend e ao serviço backend do Compose. Rodar:

Run: `docker compose exec backend ./vendor/bin/pest tests/Unit/HorarioAgendamentoTest.php tests/Feature/AgendamentoConstraintsTest.php tests/Feature/CriarSolicitacaoTest.php`

Expected: PASS.

- [ ] **Step 9: Commit da fundação**

```powershell
git add backend/config/agendamento.php backend/app/Domain/Solicitacoes/Support/HorarioAgendamento.php backend/database/migrations/2026_09_21_000003_add_agendado_para_to_solicitacoes_table.php backend/tests/Unit/HorarioAgendamentoTest.php backend/tests/Feature/AgendamentoConstraintsTest.php backend/tests/Feature/CriarSolicitacaoTest.php backend/app/Models/Solicitacao.php backend/app/Domain/Solicitacoes/Http/Resources/SolicitacaoResource.php backend/database/factories/SolicitacaoFactory.php backend/database/seeders/SolicitacoesSeeder.php backend/.env.example docker-compose.yml
git commit -m "feat(agenda): adiciona persistencia e invariantes de horario"
```

---

### Task 2: Agendamento inicial na transição de status

**Files:**
- Modify: `backend/tests/Feature/AtualizarStatusTest.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Requests/AtualizarStatusRequest.php`
- Modify: `backend/app/Domain/Solicitacoes/Actions/AtualizarStatusSolicitacao.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php`

**Interfaces:**
- Consumes: `HorarioAgendamento::interpretarLocal(string $data, string $hora, string $timezone): ?CarbonImmutable` da Task 1.
- Produces: `AtualizarStatusRequest::agendadoPara(): ?CarbonImmutable`.
- Produces: `AtualizarStatusSolicitacao::execute(Solicitacao $solicitacao, string $novoStatus, ?CarbonImmutable $agendadoPara = null): Solicitacao`.

- [ ] **Step 1: Alterar o teste feliz para exigir data/hora e acrescentar casos de validação**

```php
test('transição EM_ANALISE para AGENDADA exige e persiste data e hora', function () {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'EM_ANALISE'])->assertOk();

    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", [
        'status' => 'AGENDADA',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '14:30',
    ])->assertOk()
        ->assertJsonPath('data.status', 'AGENDADA')
        ->assertJsonPath('data.agendado_para', '2026-09-25T17:30:00+00:00');
});

test('rejeita AGENDADA sem ambos os campos, no passado ou com campo desconhecido', function (array $payload, string $campo) {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'EM_ANALISE']);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", $payload)
        ->assertStatus(422)->assertJsonStructure(['message', 'errors' => [$campo]]);
})->with([
    [['status' => 'AGENDADA', 'data_agendada' => '2026-09-25'], 'hora_agendada'],
    [['status' => 'AGENDADA', 'hora_agendada' => '14:30'], 'data_agendada'],
    [['status' => 'AGENDADA', 'data_agendada' => '2026-09-20', 'hora_agendada' => '14:30'], 'data_agendada'],
    [['status' => 'AGENDADA', 'data_agendada' => '2026-09-25', 'hora_agendada' => '14:30', 'duracao' => 30], 'duracao'],
]);
```

Fixar também estes comportamentos no mesmo arquivo:

```php
test('campos de agenda são proibidos em outro destino', function () {
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", [
        'status' => 'EM_ANALISE',
        'data_agendada' => '2026-09-25',
        'hora_agendada' => '14:30',
    ])->assertStatus(422)->assertJsonStructure(['errors' => ['data_agendada', 'hora_agendada']]);
});

test('aceita hoje quando o horário ainda é futuro', function () {
    CarbonImmutable::setTestNow('2026-09-21T15:00:00Z');
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", ['status' => 'EM_ANALISE']);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", [
        'status' => 'AGENDADA', 'data_agendada' => '2026-09-21', 'hora_agendada' => '13:00',
    ])->assertOk();
});

test('RECEBIDA para AGENDADA continua inválida com payload completo', function () {
    $sol = criarSolicitacaoViaApi($this);
    $this->patchJson("/api/v1/solicitacoes/{$sol['id']}/status", [
        'status' => 'AGENDADA', 'data_agendada' => '2026-09-25', 'hora_agendada' => '14:30',
    ])->assertStatus(409);
});

test('concluir e cancelar preservam o horário histórico', function (string $destino) {
    $solicitacao = Solicitacao::factory()->create([
        'status' => 'AGENDADA', 'agendado_para' => '2026-09-25T17:30:00Z',
    ]);
    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/status", ['status' => $destino])
        ->assertOk()->assertJsonPath('data.agendado_para', '2026-09-25T17:30:00+00:00');
})->with(['CONCLUIDA', 'CANCELADA']);
```

- [ ] **Step 2: Rodar o arquivo e confirmar RED**

Run: `docker compose exec backend ./vendor/bin/pest tests/Feature/AtualizarStatusTest.php`

Expected: FAIL porque a requisição ignora data/hora e a Action não grava o instante.

- [ ] **Step 3: Implementar validação condicional e conversão**

Em `AtualizarStatusRequest`, usar `Rule::requiredIf` e `Rule::prohibitedIf`:

```php
'data_agendada' => [
    Rule::requiredIf(fn () => $this->input('status') === 'AGENDADA'),
    Rule::prohibitedIf(fn () => $this->filled('status') && $this->input('status') !== 'AGENDADA'),
    'date_format:Y-m-d',
],
'hora_agendada' => [
    Rule::requiredIf(fn () => $this->input('status') === 'AGENDADA'),
    Rule::prohibitedIf(fn () => $this->filled('status') && $this->input('status') !== 'AGENDADA'),
    'date_format:H:i',
],
```

No `withValidator`, rejeitar qualquer chave fora de `status`, `data_agendada`, `hora_agendada`; quando não houver erros estruturais e o destino for `AGENDADA`, chamar `HorarioAgendamento::interpretarLocal`. Adicionar erro em `data_agendada` se o resultado for nulo ou não for estritamente futuro. Guardar o instante em propriedade privada e expor por `agendadoPara()`.

- [ ] **Step 4: Atualizar Action e Controller minimamente**

```php
public function execute(
    Solicitacao $solicitacao,
    string $novoStatus,
    ?CarbonImmutable $agendadoPara = null,
): Solicitacao {
    return DB::transaction(function () use ($solicitacao, $novoStatus, $agendadoPara) {
        $solicitacao = Solicitacao::lockForUpdate()->findOrFail($solicitacao->id);
        $permitidos = self::TRANSICOES[$solicitacao->status] ?? [];

        if (!in_array($novoStatus, $permitidos, true)) {
            $this->conflito("Transição de '{$solicitacao->status}' para '{$novoStatus}' não é permitida.");
        }
        if ($novoStatus === 'AGENDADA' && $agendadoPara === null) {
            $this->conflito('A data e o horário são obrigatórios para agendar a solicitação.');
        }

        $dados = ['status' => $novoStatus];
        if ($novoStatus === 'AGENDADA') {
            $dados['agendado_para'] = $agendadoPara;
        }
        $solicitacao->update($dados);
        return $solicitacao->fresh();
    });
}
```

Controller:

```php
$atualizada = $this->atualizarStatus->execute(
    $solicitacao,
    $request->validated('status'),
    $request->agendadoPara(),
);
```

- [ ] **Step 5: Cobrir o relock de uma instância obsoleta**

No teste, carregar duas instâncias de uma solicitação `EM_ANALISE`, executar a primeira transição diretamente pela Action e verificar que a segunda recebe `HttpResponseException` 409 após reler o estado bloqueado. Isso fixa a proteção contra uma requisição atrasada sem depender de temporização entre processos.

- [ ] **Step 6: Rodar o arquivo e confirmar GREEN**

Run: `docker compose exec backend ./vendor/bin/pest tests/Feature/AtualizarStatusTest.php`

Expected: PASS, incluindo persistência UTC, validações, preservação histórica e relock.

- [ ] **Step 7: Commit do agendamento inicial**

```powershell
git add backend/tests/Feature/AtualizarStatusTest.php backend/app/Domain/Solicitacoes/Http/Requests/AtualizarStatusRequest.php backend/app/Domain/Solicitacoes/Actions/AtualizarStatusSolicitacao.php backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php
git commit -m "feat(agenda): exige horario ao agendar solicitacao"
```

---

### Task 3: Reagendamento idempotente e serializado

**Files:**
- Create: `backend/app/Domain/Solicitacoes/Actions/ReagendarSolicitacao.php`
- Create: `backend/app/Domain/Solicitacoes/Http/Requests/ReagendarSolicitacaoRequest.php`
- Create: `backend/tests/Feature/ReagendarSolicitacaoTest.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Consumes: `HorarioAgendamento::interpretarLocal(string $data, string $hora, string $timezone): ?CarbonImmutable` da Task 1.
- Produces: `ReagendarSolicitacaoRequest::agendadoPara(): CarbonImmutable`.
- Produces: `ReagendarSolicitacao::execute(Solicitacao $solicitacao, CarbonImmutable $agendadoPara): Solicitacao`.
- Produces: `PATCH /api/v1/solicitacoes/{id}/agendamento`.

- [ ] **Step 1: Escrever os testes falhos do endpoint**

```php
test('reagenda somente uma solicitação AGENDADA', function () {
    $solicitacao = Solicitacao::factory()->create([
        'status' => 'AGENDADA',
        'agendado_para' => '2026-09-25T17:30:00Z',
    ]);

    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/agendamento", [
        'data_agendada' => '2026-09-28',
        'hora_agendada' => '09:00',
    ])->assertOk()
        ->assertJsonPath('data.status', 'AGENDADA')
        ->assertJsonPath('data.agendado_para', '2026-09-28T12:00:00+00:00');
});

test('reagendamento em estado incompatível retorna 409', function () {
    $solicitacao = Solicitacao::factory()->create(['status' => 'EM_ANALISE']);
    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/agendamento", [
        'data_agendada' => '2026-09-28',
        'hora_agendada' => '09:00',
    ])->assertStatus(409)->assertJsonStructure(['message', 'errors']);
});
```

Fixar validação, idempotência e serialização com estes casos:

```php
test('reagendamento valida payload estritamente', function (array $payload, string $campo) {
    $solicitacao = Solicitacao::factory()->create([
        'status' => 'AGENDADA', 'agendado_para' => '2026-09-25T17:30:00Z',
    ]);
    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/agendamento", $payload)
        ->assertStatus(422)->assertJsonStructure(['errors' => [$campo]]);
})->with([
    [['data_agendada' => '2026-09-28'], 'hora_agendada'],
    [['hora_agendada' => '09:00'], 'data_agendada'],
    [['data_agendada' => '2026-09-20', 'hora_agendada' => '09:00'], 'data_agendada'],
    [['data_agendada' => '2026-09-28', 'hora_agendada' => '09:00', 'sala' => 2], 'sala'],
]);

test('reagendar para o mesmo instante não altera updated_at', function () {
    $solicitacao = Solicitacao::factory()->create([
        'status' => 'AGENDADA', 'agendado_para' => '2026-09-25T17:30:00Z',
        'updated_at' => '2026-09-21T15:00:00Z',
    ]);
    CarbonImmutable::setTestNow('2026-09-22T15:00:00Z');
    $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/agendamento", [
        'data_agendada' => '2026-09-25', 'hora_agendada' => '14:30',
    ])->assertOk();
    expect($solicitacao->fresh()->updated_at->toIso8601String())->toBe('2026-09-21T15:00:00+00:00');
});

test('chamadores obsoletos são serializados e o último valor válido vence', function () {
    $solicitacao = Solicitacao::factory()->create([
        'status' => 'AGENDADA', 'agendado_para' => '2026-09-25T17:30:00Z',
    ]);
    $primeira = Solicitacao::findOrFail($solicitacao->id);
    $segunda = Solicitacao::findOrFail($solicitacao->id);
    $action = app(ReagendarSolicitacao::class);
    $action->execute($primeira, CarbonImmutable::parse('2026-09-28T12:00:00Z'));
    $action->execute($segunda, CarbonImmutable::parse('2026-09-29T13:00:00Z'));
    expect($solicitacao->fresh()->agendado_para->toIso8601String())->toBe('2026-09-29T13:00:00+00:00');
});
```

Completar o arquivo com:

```php
test('reagendamento inexistente retorna 404', function () {
    $this->patchJson('/api/v1/solicitacoes/999999/agendamento', [
        'data_agendada' => '2026-09-28', 'hora_agendada' => '09:00',
    ])->assertStatus(404);
});

test('duas solicitações podem terminar no mesmo horário', function () {
    $solicitacoes = Solicitacao::factory()->count(2)->create([
        'status' => 'AGENDADA', 'agendado_para' => '2026-09-25T17:30:00Z',
    ]);
    foreach ($solicitacoes as $solicitacao) {
        $this->patchJson("/api/v1/solicitacoes/{$solicitacao->id}/agendamento", [
            'data_agendada' => '2026-09-28', 'hora_agendada' => '09:00',
        ])->assertOk();
    }
    expect(Solicitacao::where('agendado_para', '2026-09-28T12:00:00Z')->count())->toBe(2);
});
```

- [ ] **Step 2: Rodar e confirmar RED**

Run: `docker compose exec backend ./vendor/bin/pest tests/Feature/ReagendarSolicitacaoTest.php`

Expected: FAIL com rota 404.

- [ ] **Step 3: Implementar Request, Action, Controller e rota**

A Request usa as mesmas regras estritas da Task 2, mas data e hora são sempre `required`. A Action não altera status:

```php
public function execute(Solicitacao $solicitacao, CarbonImmutable $agendadoPara): Solicitacao
{
    return DB::transaction(function () use ($solicitacao, $agendadoPara) {
        $solicitacao = Solicitacao::lockForUpdate()->findOrFail($solicitacao->id);
        if ($solicitacao->status !== 'AGENDADA') {
            $this->conflito('Somente solicitações agendadas podem ser reagendadas.');
        }
        if ($solicitacao->agendado_para?->equalTo($agendadoPara)) {
            return $solicitacao;
        }
        $solicitacao->update(['agendado_para' => $agendadoPara]);
        return $solicitacao->fresh();
    });
}
```

Injetar a Action no controller e criar `updateAgendamento(ReagendarSolicitacaoRequest $request, int $id): JsonResponse` com Request → Action → Resource. Registrar:

```php
Route::patch('/solicitacoes/{id}/agendamento', [SolicitacaoController::class, 'updateAgendamento']);
```

- [ ] **Step 4: Rodar e confirmar GREEN**

Run: `docker compose exec backend ./vendor/bin/pest tests/Feature/ReagendarSolicitacaoTest.php`

Expected: PASS.

- [ ] **Step 5: Commit do reagendamento**

```powershell
git add backend/app/Domain/Solicitacoes/Actions/ReagendarSolicitacao.php backend/app/Domain/Solicitacoes/Http/Requests/ReagendarSolicitacaoRequest.php backend/tests/Feature/ReagendarSolicitacaoTest.php backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php backend/routes/api.php
git commit -m "feat(agenda): adiciona reagendamento idempotente"
```

---

### Task 4: Filtro diário e ordenação da agenda

**Files:**
- Modify: `backend/tests/Feature/ListarSolicitacoesTest.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Requests/ListarSolicitacoesRequest.php`
- Modify: `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php`

**Interfaces:**
- Consumes: `HorarioAgendamento::limitesUtcDoDia(string $data, string $timezone): array{0: CarbonImmutable, 1: CarbonImmutable}` da Task 1.
- Produces: query `data_agendada=YYYY-MM-DD`; quando presente, restringe a `AGENDADA` e ordena por horário, prioridade, protocolo e id.

- [ ] **Step 1: Escrever testes falhos do intervalo e da ordem**

```php
test('filtra o dia operacional e ordena horário prioridade protocolo', function () {
    $criar = fn (string $protocolo, string $prioridade, string $utc) => Solicitacao::factory()->create([
        'protocolo' => $protocolo,
        'prioridade' => $prioridade,
        'justificativa_prioridade' => $prioridade === 'URGENTE' ? 'Teste fictício.' : null,
        'status' => 'AGENDADA',
        'agendado_para' => $utc,
    ]);
    $criar('SOL-2026-0203', 'BAIXA', '2026-09-25T12:00:00Z');
    $criar('SOL-2026-0202', 'URGENTE', '2026-09-25T12:00:00Z');
    $criar('SOL-2026-0201', 'ALTA', '2026-09-25T11:00:00Z');
    $criar('SOL-2026-0204', 'URGENTE', '2026-09-26T03:00:00Z');

    $response = $this->getJson('/api/v1/solicitacoes?data_agendada=2026-09-25');
    $response->assertOk();
    expect($response->json('data.*.protocolo'))->toBe([
        'SOL-2026-0201', 'SOL-2026-0202', 'SOL-2026-0203',
    ]);
});
```

Fixar as combinações da query com testes parametrizados:

```php
test('rejeita combinações incompatíveis da agenda', function (string $query, string $campo) {
    $this->getJson("/api/v1/solicitacoes?$query")
        ->assertStatus(422)->assertJsonStructure(['errors' => [$campo]]);
})->with([
    ['data_agendada=2026-09-25&status=EM_ANALISE', 'status'],
    ['data_agendada=2026-09-25&status_grupo=encerrado', 'status_grupo'],
    ['data_agendada=25-09-2026', 'data_agendada'],
]);

test('agenda aceita grupo aberto e pagina resultados', function () {
    Solicitacao::factory()->count(3)->create([
        'status' => 'AGENDADA', 'agendado_para' => '2026-09-25T12:00:00Z',
    ]);
    $response = $this->getJson('/api/v1/solicitacoes?data_agendada=2026-09-25&status_grupo=aberto&per_page=2&page=2');
    $response->assertOk()->assertJsonPath('meta.total', 3)->assertJsonCount(1, 'data');
});
```

O primeiro teste desta tarefa já omite `status` e comprova que apenas `AGENDADA` aparece, porque a fixture fora do intervalo e qualquer estado não agendado ficam ausentes.

- [ ] **Step 2: Rodar e confirmar RED**

Run: `docker compose exec backend ./vendor/bin/pest tests/Feature/ListarSolicitacoesTest.php`

Expected: FAIL porque `data_agendada` é ignorada.

- [ ] **Step 3: Implementar validação de compatibilidade**

Adicionar `data_agendada => ['nullable', 'date_format:Y-m-d']`. No `withValidator`, quando a data estiver preenchida:

```php
if ($this->filled('status') && $this->input('status') !== 'AGENDADA') {
    $validator->errors()->add('status', 'O filtro de data aceita apenas o status AGENDADA.');
}
if ($this->input('status_grupo') === 'encerrado') {
    $validator->errors()->add('status_grupo', 'A agenda diária não pertence ao histórico encerrado.');
}
```

- [ ] **Step 4: Implementar o branch de consulta antes das ordenações existentes**

```php
if ($dataAgendada = $request->validated('data_agendada')) {
    [$inicio, $fim] = HorarioAgendamento::limitesUtcDoDia(
        $dataAgendada,
        config('agendamento.timezone'),
    );
    $query->where('status', 'AGENDADA')
        ->where('agendado_para', '>=', $inicio)
        ->where('agendado_para', '<', $fim)
        ->orderBy('agendado_para')
        ->orderByRaw("CASE prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 END ASC")
        ->orderBy('protocolo')
        ->orderBy('id');
} elseif ($statusGrupo === 'encerrado') {
    $query->whereIn('status', ['CONCLUIDA', 'CANCELADA'])
        ->orderByDesc('updated_at')
        ->orderByDesc('id');
} else {
    $query->orderByRaw("CASE WHEN status IN ('CONCLUIDA', 'CANCELADA') THEN 1 ELSE 0 END ASC")
        ->orderByRaw("CASE prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 END ASC")
        ->orderBy('created_at')
        ->orderBy('id');
}
```

Aplicar categoria e prioridade depois desse branch. Não reaplicar um status incompatível; a Request já garante a combinação.

- [ ] **Step 5: Rodar e confirmar GREEN sem regressão da fila**

Run: `docker compose exec backend ./vendor/bin/pest tests/Feature/ListarSolicitacoesTest.php`

Expected: PASS para os testes novos e para a ordenação legada.

- [ ] **Step 6: Commit da consulta diária**

```powershell
git add backend/tests/Feature/ListarSolicitacoesTest.php backend/app/Domain/Solicitacoes/Http/Requests/ListarSolicitacoesRequest.php backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php
git commit -m "feat(agenda): lista agendamentos por dia operacional"
```

---

### Task 5: Contrato frontend e formulário acessível

**Files:**
- Create: `frontend/src/vite-env.d.ts`
- Create: `frontend/src/features/solicitacoes/config/agendamento.ts`
- Create: `frontend/src/features/solicitacoes/components/AgendamentoForm.tsx`
- Create: `frontend/src/test/agendamento-form.test.tsx`
- Modify: `frontend/src/features/solicitacoes/types/index.ts`
- Modify: `frontend/src/features/solicitacoes/api/client.ts`
- Modify: `frontend/src/test/solicitacoes.test.tsx`
- Modify: `frontend/.env.example`
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: `AgendamentoPayload { data_agendada: string; hora_agendada: string }`.
- Produces: `AtualizarStatusPayload` como união discriminada: `AGENDADA` exige `AgendamentoPayload`; os demais status proíbem esses campos no TypeScript.
- Produces: `solicitacoesApi.atualizarStatus(id: string, payload: AtualizarStatusPayload)`.
- Produces: `solicitacoesApi.reagendar(id: string, payload: AgendamentoPayload)`.
- Produces: `AgendamentoForm` com `initialValue`, `submitting`, `serverErrors`, `onSubmit` e `onCancel`.
- Produces: `dataHojeNoFuso(agora?: Date): string` e `dataIsoValida(value: string | null): value is string` para a URL da agenda.

- [ ] **Step 1: Escrever testes falhos do formulário**

```tsx
it('exige data e hora, foca o resumo e envia valores válidos', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<AgendamentoForm submitting={false} serverErrors={{}} onSubmit={onSubmit} onCancel={vi.fn()} />);

  await user.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
  expect(screen.getByRole('alert')).toHaveFocus();
  expect(screen.getByText('Informe a data do atendimento.')).toBeInTheDocument();
  expect(screen.getByText('Informe o horário do atendimento.')).toBeInTheDocument();

  await user.type(screen.getByLabelText('Data do atendimento'), '2026-09-25');
  await user.type(screen.getByLabelText('Horário do atendimento'), '14:30');
  await user.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
  expect(onSubmit).toHaveBeenCalledWith({ data_agendada: '2026-09-25', hora_agendada: '14:30' });
});
```

Adicionar teste de preenchimento inicial, erro de servidor por campo, `aria-busy` e preservação dos valores após rerender com erro.

- [ ] **Step 2: Rodar e confirmar RED**

Run: `Set-Location frontend; npm run test -- --run src/test/agendamento-form.test.tsx`

Expected: FAIL porque o componente e os tipos não existem.

- [ ] **Step 3: Implementar tipos, configuração e formatação no fuso**

Adicionar ao contrato:

Adicionar `agendado_para: string | null` logo depois de `status` na interface `Solicitacao` existente. Definir os payloads completos:

```ts
export interface AgendamentoPayload {
  data_agendada: string;
  hora_agendada: string;
}

export type StatusSemAgendamento = Exclude<Status, 'AGENDADA'>;

export type AtualizarStatusPayload =
  | ({ status: 'AGENDADA' } & AgendamentoPayload)
  | {
      status: StatusSemAgendamento;
      data_agendada?: never;
      hora_agendada?: never;
    };
```

Adicionar `data_agendada?: string` a `FiltrosSolicitacoes`. Em `vite-env.d.ts`, referenciar `vite/client` e tipar `VITE_AGENDAMENTO_TIMEZONE`. Em `config/agendamento.ts`, exportar `AGENDAMENTO_TIMEZONE`, `formatarAgendamento(iso)`, `camposDoAgendamento(iso)`, `dataHojeNoFuso(agora = new Date())` e `dataIsoValida(value)`. A formatação usa `Intl.DateTimeFormat('pt-BR', { timeZone: AGENDAMENTO_TIMEZONE, dateStyle: 'short', timeStyle: 'short' })`; a extração e a data atual usam `formatToParts` com `year`, `month`, `day`, `hour` e `minute` em dois dígitos. `dataIsoValida` exige `/^\d{4}-\d{2}-\d{2}$/` e confirma que os componentes sobrevivem a uma construção UTC sem normalização.

- [ ] **Step 4: Implementar cliente e formulário**

O cliente deve serializar o payload completo:

```ts
async atualizarStatus(id: string, payload: AtualizarStatusPayload): Promise<Solicitacao> {
  const res = await request<{ data: Solicitacao }>(`/api/v1/solicitacoes/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res?.data) throw new Error('Não foi possível confirmar a atualização do status. Tente novamente.');
  return res.data;
},

async reagendar(id: string, payload: AgendamentoPayload): Promise<Solicitacao> {
  const res = await request<{ data: Solicitacao }>(`/api/v1/solicitacoes/${id}/agendamento`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res?.data) throw new Error('Não foi possível confirmar o reagendamento. Tente novamente.');
  return res.data;
},
```

`AgendamentoForm` usa `<input type="date">` e `<input type="time" step="60">`, labels permanentes, helper `Horário local — America/Recife`, validação obrigatória em blur e submit, resumo com `tabIndex={-1}`, `aria-invalid`, `aria-describedby`, região `aria-busy` e botões “Confirmar agendamento”/“Salvar novo horário” conforme prop `mode`.

- [ ] **Step 5: Atualizar fixtures existentes e confirmar GREEN**

Adicionar `agendado_para: null` às fixtures tipadas e `reagendar: vi.fn()` aos mocks existentes. Rodar:

Run: `Set-Location frontend; npm run test -- --run src/test/agendamento-form.test.tsx src/test/solicitacoes.test.tsx`

Expected: PASS.

- [ ] **Step 6: Configurar o ambiente e commitar**

Adicionar `VITE_AGENDAMENTO_TIMEZONE=America/Recife` ao `.env.example` e ao serviço frontend do Compose.

```powershell
git add frontend/src/vite-env.d.ts frontend/src/features/solicitacoes/config/agendamento.ts frontend/src/features/solicitacoes/components/AgendamentoForm.tsx frontend/src/test/agendamento-form.test.tsx frontend/src/features/solicitacoes/types/index.ts frontend/src/features/solicitacoes/api/client.ts frontend/src/test/solicitacoes.test.tsx frontend/.env.example docker-compose.yml
git commit -m "feat(agenda): adiciona contrato e formulario de horario"
```

---

### Task 6: Fluxos de agendamento e reagendamento no detalhe

**Files:**
- Create: `frontend/src/test/agendamento-detalhe.test.tsx`
- Modify: `frontend/src/features/solicitacoes/pages/SolicitacaoDetailPage.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `AgendamentoForm`, `solicitacoesApi.atualizarStatus` e `solicitacoesApi.reagendar` da Task 5.
- Produces: painel inline para agendar `EM_ANALISE` e reagendar `AGENDADA`.

- [ ] **Step 1: Escrever testes falhos dos dois fluxos**

No início de `agendamento-detalhe.test.tsx`, configurar o cliente mockado, a fixture e os helpers usados por todos os testes:

```tsx
const solicitacaoBase: Solicitacao = {
  id: 1,
  protocolo: 'SOL-2026-0001',
  nome_solicitante: 'Maria da Silva',
  cpf_solicitante: '123.456.789-00',
  data_nascimento: '1985-06-15',
  categoria: 'CONSULTA',
  prioridade: 'MEDIA',
  status: 'RECEBIDA',
  descricao: 'Consulta fictícia.',
  justificativa_prioridade: null,
  agendado_para: null,
  data_criacao: '2026-09-17T12:00:00Z',
  data_atualizacao: '2026-09-17T12:00:00Z',
};

function renderDetalhe(solicitacao: Solicitacao) {
  vi.mocked(solicitacoesApi.buscar).mockResolvedValue(solicitacao);
  return render(
    <MemoryRouter initialEntries={[`/solicitacoes/${solicitacao.id}`]}>
      <Routes><Route path="/solicitacoes/:id" element={<SolicitacaoDetailPage />} /></Routes>
    </MemoryRouter>
  );
}

async function abrirEPreencherAgendamento(data: string, hora: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'Agendar atendimento' }));
  fireEvent.change(screen.getByLabelText('Data do atendimento'), { target: { value: data } });
  fireEvent.change(screen.getByLabelText('Horário do atendimento'), { target: { value: hora } });
}
```

```tsx
it('agenda EM_ANALISE com data e hora obrigatórias', async () => {
  renderDetalhe({ ...solicitacaoBase, status: 'EM_ANALISE' });
  await userEvent.click(await screen.findByRole('button', { name: 'Agendar atendimento' }));
  await userEvent.type(screen.getByLabelText('Data do atendimento'), '2026-09-25');
  await userEvent.type(screen.getByLabelText('Horário do atendimento'), '14:30');
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
  expect(solicitacoesApi.atualizarStatus).toHaveBeenCalledWith('1', {
    status: 'AGENDADA', data_agendada: '2026-09-25', hora_agendada: '14:30',
  });
});

it('preenche e salva o reagendamento de AGENDADA', async () => {
  renderDetalhe({ ...solicitacaoBase, status: 'AGENDADA', agendado_para: '2026-09-25T17:30:00Z' });
  expect(await screen.findByText(/25\/09\/2026/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Alterar agendamento' }));
  expect(screen.getByLabelText('Horário do atendimento')).toHaveValue('14:30');
});

it('mostra o horário histórico em estado terminal sem oferecer reagendamento', async () => {
  renderDetalhe({ ...solicitacaoBase, status: 'CONCLUIDA', agendado_para: '2026-09-25T17:30:00Z' });
  expect(await screen.findByText(/25\/09\/2026/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Alterar agendamento' })).not.toBeInTheDocument();
});
```

Fixar os estados de interação com testes explícitos:

```tsx
it('preserva valores no 422 e associa o erro ao campo', async () => {
  vi.mocked(solicitacoesApi.atualizarStatus).mockRejectedValue(Object.assign(new Error('Dados inválidos'), {
    status: 422, errors: { hora_agendada: ['O horário deve ser futuro.'] },
  }));
  renderDetalhe({ ...solicitacaoBase, status: 'EM_ANALISE' });
  await abrirEPreencherAgendamento('2026-09-25', '14:30');
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
  expect(await screen.findByText('O horário deve ser futuro.')).toBeInTheDocument();
  expect(screen.getByLabelText('Horário do atendimento')).toHaveValue('14:30');
});

it('recarrega e explica conflito 409 sem apagar o formulário', async () => {
  vi.mocked(solicitacoesApi.atualizarStatus).mockRejectedValue(Object.assign(new Error('Conflito'), {
    status: 409, errors: {},
  }));
  renderDetalhe({ ...solicitacaoBase, status: 'EM_ANALISE' });
  await abrirEPreencherAgendamento('2026-09-25', '14:30');
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
  expect(await screen.findByText(/mudou enquanto você editava/i)).toBeInTheDocument();
  expect(solicitacoesApi.buscar).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText('Data do atendimento')).toHaveValue('2026-09-25');
});

it('cancelar edição restaura o foco e mantém concluir e cancelar separados', async () => {
  renderDetalhe({ ...solicitacaoBase, status: 'AGENDADA', agendado_para: '2026-09-25T17:30:00Z' });
  const abrir = await screen.findByRole('button', { name: 'Alterar agendamento' });
  await userEvent.click(abrir);
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar edição' }));
  expect(abrir).toHaveFocus();
  expect(screen.getByRole('button', { name: /Mover para Concluída/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Mover para Cancelada/ })).toBeInTheDocument();
});
```

No teste feliz, após a resposta resolvida, verificar `expect(screen.getByRole('status')).toHaveTextContent('Agendamento confirmado')`.

- [ ] **Step 2: Rodar e confirmar RED**

Run: `Set-Location frontend; npm run test -- --run src/test/agendamento-detalhe.test.tsx`

Expected: FAIL porque a página ainda renderiza “Mover para Agendada”.

- [ ] **Step 3: Integrar o painel sem mudar as outras transições**

Na página:

- remover `AGENDADA` do `map` de botões genéricos;
- em `EM_ANALISE`, renderizar “Agendar atendimento” e abrir o formulário vazio;
- em `AGENDADA`, renderizar o valor formatado e “Alterar agendamento” com formulário preenchido;
- incluir “Agendado para” nas informações da solicitação sempre que `agendado_para` não for nulo, inclusive em estado terminal;
- manter confirmação para `CONCLUIDA` e `CANCELADA`, estreitar o handler para `StatusSemAgendamento` e chamar `atualizarStatus(id, { status })`;
- em sucesso, fechar o formulário, recarregar e anunciar;
- em 422, passar `caught.errors` ao formulário;
- em 409, manter os valores, chamar `reload()` e exibir “A solicitação mudou enquanto você editava. Revise o estado atual e tente novamente.”.

Usar uma ref no botão que abriu o painel para restaurar foco no cancelamento.

- [ ] **Step 4: Acrescentar estilos com tokens existentes**

Criar classes `.schedule-summary`, `.schedule-form`, `.schedule-form__context`, `.schedule-form__fields` e `.schedule-form__actions` usando apenas `--space-*`, `--color-*`, `--radius-*`, `--slate-*` e `--teal-*`. Em telas abaixo de 48rem, transformar os dois campos e ações em uma coluna. Não criar cor ou token específico da agenda.

- [ ] **Step 5: Rodar testes e verificação estática**

```powershell
Set-Location frontend
npm run test -- --run src/test/agendamento-detalhe.test.tsx src/test/solicitacoes.test.tsx
npx tsc --noEmit
npm run lint
Set-Location ..
```

Expected: todos os comandos com exit code 0.

- [ ] **Step 6: Commit da página de detalhe**

```powershell
git add frontend/src/test/agendamento-detalhe.test.tsx frontend/src/features/solicitacoes/pages/SolicitacaoDetailPage.tsx frontend/src/index.css
git commit -m "feat(agenda): integra agendamento ao detalhe"
```

---

### Task 7: Visão diária no painel e URL estável

**Files:**
- Create: `frontend/src/test/agenda.test.tsx`
- Modify: `frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx`
- Modify: `frontend/src/features/solicitacoes/hooks/useSolicitacoes.ts`
- Modify: `frontend/src/features/solicitacoes/api/client.ts`
- Modify: `frontend/src/test/solicitacoes.test.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `FiltrosSolicitacoes.data_agendada` e `Solicitacao.agendado_para` da Task 5.
- Produces: URL `/?visao=agenda&data=YYYY-MM-DD` e consulta `{ status: 'AGENDADA', data_agendada, page, per_page: 10 }`.

- [ ] **Step 1: Escrever testes falhos de navegação, consulta e estados**

Criar a fixture e o helper do arquivo de teste, importar `dataHojeNoFuso` da configuração da agenda e restaurar os timers em `afterEach`:

```tsx
const solicitacaoBase: Solicitacao = {
  id: 1,
  protocolo: 'SOL-2026-0001',
  nome_solicitante: 'Maria da Silva',
  cpf_solicitante: '123.456.789-00',
  data_nascimento: '1985-06-15',
  categoria: 'CONSULTA',
  prioridade: 'MEDIA',
  status: 'RECEBIDA',
  descricao: 'Consulta fictícia.',
  justificativa_prioridade: null,
  agendado_para: null,
  data_criacao: '2026-09-17T12:00:00Z',
  data_atualizacao: '2026-09-17T12:00:00Z',
};

afterEach(() => {
  vi.useRealTimers();
});

function renderPagina(entrada: string) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes><Route path="/" element={<SolicitacoesPage />} /></Routes>
    </MemoryRouter>
  );
}
```

```tsx
it('abre agenda pelo dia da URL e consulta somente AGENDADA', async () => {
  render(
    <MemoryRouter initialEntries={['/?visao=agenda&data=2026-09-25']}>
      <Routes><Route path="/" element={<SolicitacoesPage />} /></Routes>
    </MemoryRouter>
  );
  expect(await screen.findByRole('heading', { name: 'Agenda do dia' })).toBeInTheDocument();
  expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({
    status: 'AGENDADA', data_agendada: '2026-09-25', page: 1, per_page: 10,
  }));
});

it('mantém a data selecionada depois da virada do relógio', async () => {
  vi.setSystemTime('2026-09-25T23:59:00-03:00');
  renderPagina('/?visao=agenda&data=2026-09-25');
  await screen.findByDisplayValue('2026-09-25');
  vi.setSystemTime('2026-09-26T00:01:00-03:00');
  expect(screen.getByLabelText('Data da agenda')).toHaveValue('2026-09-25');
});
```

Fixar paginação, normalização e estados com estes testes:

```tsx
it('trocar o dia volta à página um e normaliza data inválida', async () => {
  vi.mocked(solicitacoesApi.listar).mockImplementation(async (filtros) =>
    filtros?.per_page === 1
      ? { data: [], total: 0, last_page: 1 }
      : { data: [], total: 20, last_page: 2 }
  );
  renderPagina('/?visao=agenda&data=invalida');
  const campo = await screen.findByLabelText('Data da agenda');
  expect(campo).toHaveValue(dataHojeNoFuso());
  await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  fireEvent.change(campo, { target: { value: '2026-09-27' } });
  expect(solicitacoesApi.listar).toHaveBeenLastCalledWith(expect.objectContaining({
    data_agendada: '2026-09-27', page: 1,
  }));
});

it('renderiza erro recuperável e depois o estado vazio', async () => {
  vi.mocked(solicitacoesApi.listar)
    .mockRejectedValueOnce(new Error('Falha de rede'))
    .mockResolvedValue({ data: [], total: 0, last_page: 1 });
  renderPagina('/?visao=agenda&data=2026-09-25');
  await userEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText('Nenhum atendimento agendado para este dia')).toBeInTheDocument();
});

it('mantém solicitações diferentes no mesmo horário', async () => {
  vi.mocked(solicitacoesApi.listar).mockResolvedValue({
    data: [
      { ...solicitacaoBase, id: 1, protocolo: 'SOL-2026-0001', status: 'AGENDADA', agendado_para: '2026-09-25T12:00:00Z' },
      { ...solicitacaoBase, id: 2, protocolo: 'SOL-2026-0002', status: 'AGENDADA', agendado_para: '2026-09-25T12:00:00Z' },
    ], total: 2, last_page: 1,
  });
  renderPagina('/?visao=agenda&data=2026-09-25');
  expect(await screen.findByText('SOL-2026-0001')).toBeInTheDocument();
  expect(screen.getByText('SOL-2026-0002')).toBeInTheDocument();
  expect(screen.getAllByText(/09:00/)).toHaveLength(2);
});

it('preserva fila, histórico e renomeia o destaque operacional', async () => {
  renderPagina('/');
  expect(await screen.findByText('Próxima solicitação por prioridade')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Histórico encerrado' }));
  expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({ status_grupo: 'encerrado' }));
  await userEvent.click(screen.getByRole('button', { name: 'Fila atual' }));
  expect(solicitacoesApi.listar).toHaveBeenCalledWith(expect.objectContaining({ status_grupo: 'aberto' }));
});
```

- [ ] **Step 2: Rodar e confirmar RED**

Run: `Set-Location frontend; npm run test -- --run src/test/agenda.test.tsx src/test/solicitacoes.test.tsx`

Expected: FAIL porque não existe a visão `agenda` nem serialização do filtro diário.

- [ ] **Step 3: Serializar o filtro e renomear o conceito de próxima solicitação**

Em `client.ts`:

```ts
if (filtros.data_agendada) params.set('data_agendada', filtros.data_agendada);
```

Renomear `useProximoAtendimento` para `useProximaSolicitacao`, mantendo a consulta `{ status_grupo: 'aberto', per_page: 1 }`. Atualizar textos para “Próxima solicitação por prioridade” e “Abrir solicitação”.

- [ ] **Step 4: Implementar estado inicial e URL da visão**

Usar `useSearchParams` e um estado inicial calculado uma única vez:

```ts
type VisaoPrincipal = 'fila' | 'agenda' | 'historico';

const [searchParams, setSearchParams] = useSearchParams();
const [visao, setVisao] = useState<VisaoPrincipal>(() =>
  searchParams.get('visao') === 'agenda'
    ? 'agenda'
    : searchParams.get('visao') === 'historico' ? 'historico' : 'fila'
);
const [dataAgenda, setDataAgenda] = useState(() =>
  dataIsoValida(searchParams.get('data')) ? searchParams.get('data')! : dataHojeNoFuso()
);
```

Ao mudar para agenda ou trocar a data, chamar `setSearchParams({ visao: 'agenda', data: novaData })`. Ao voltar para fila, limpar os parâmetros; no histórico, usar `{ visao: 'historico' }`. Nunca recalcular `dataAgenda` por passagem do tempo.

- [ ] **Step 5: Renderizar a terceira visão**

Na agenda:

- ocultar o seletor de status, pois ele é fixo em `AGENDADA`;
- manter categoria e prioridade como filtros opcionais;
- exibir o campo “Data da agenda”;
- mudar título para “Agenda do dia” e hint para “Atendimentos ordenados por horário e, no empate, por prioridade.”;
- substituir a coluna “Registrada em” por “Agendado para” e formatar `agendado_para` no fuso;
- ocultar o dashboard global e o cartão de próxima prioridade, mantendo-os na visão fila;
- manter paginação, carregamento, erro e vazio com cópias específicas.

- [ ] **Step 6: Estilizar seletor de dia e validar responsividade**

Adicionar `.agenda-toolbar` e `.agenda-date-field` reaproveitando as regras de `.filter-field`. Garantir layout em uma coluna abaixo de 48rem e sem overflow em 320 px.

- [ ] **Step 7: Rodar testes, tipos, lint e build**

```powershell
Set-Location frontend
npm run test -- --run
npx tsc --noEmit
npm run lint
npm run build
Set-Location ..
```

Expected: todos os comandos com exit code 0.

- [ ] **Step 8: Commit da agenda diária**

```powershell
git add frontend/src/test/agenda.test.tsx frontend/src/features/solicitacoes/pages/SolicitacoesPage.tsx frontend/src/features/solicitacoes/hooks/useSolicitacoes.ts frontend/src/features/solicitacoes/api/client.ts frontend/src/test/solicitacoes.test.tsx frontend/src/index.css
git commit -m "feat(agenda): adiciona visao diaria ao painel"
```

---

### Task 8: Contrato, documentação e verificação integrada

**Files:**
- Modify: `docs/spec.md`
- Modify: `docs/openapi.yaml`
- Modify: `docs/architecture.md`
- Modify: `docs/codebase-map.md`
- Modify: `README.md`
- Modify: `TASKS.md`
- Rewrite: `HANDOFF.md`

**Interfaces:**
- Consumes: todos os contratos implementados nas Tasks 1–7.
- Produces: documentação sincronizada, evidência de verificação e grafo atualizado.

- [ ] **Step 1: Atualizar o contrato interno e OpenAPI**

Em `docs/spec.md`, adicionar `agendado_para: string | null`, invariantes, payload condicional do PATCH de status, endpoint de reagendamento, filtro diário, fuso e ordenação. Em `docs/openapi.yaml`, declarar:

```yaml
AgendamentoInput:
  type: object
  additionalProperties: false
  required: [data_agendada, hora_agendada]
  properties:
    data_agendada:
      type: string
      format: date
      example: '2026-09-25'
    hora_agendada:
      type: string
      pattern: '^([01]\d|2[0-3]):[0-5]\d$'
      example: '14:30'
```

Documentar que igualdade de horário não é conflito e que a chegada ao local não é registrada.

- [ ] **Step 2: Atualizar arquitetura, mapa e operação**

No diagrama de `docs/architecture.md`, incluir `AgendamentoForm → PATCH status/agendamento → Action → agendado_para`. No mapa, indicar os dois pontos de mutação e o filtro diário. No README, incluir variáveis de fuso, exemplos de `curl` para agendar/reagendar/listar por dia e a observação de implantação coordenada.

- [ ] **Step 3: Rodar a suíte completa do backend**

```powershell
docker compose exec backend ./vendor/bin/pint --test
docker compose exec backend ./vendor/bin/pest
```

Expected: lint e todos os testes com exit code 0.

- [ ] **Step 4: Rodar a suíte completa do frontend**

```powershell
Set-Location frontend
npm run test -- --run
npx tsc --noEmit
npm run lint
npm run build
Set-Location ..
```

Expected: testes, tipos, lint e build com exit code 0.

- [ ] **Step 5: Verificar o fluxo integrado**

Subir a stack, criar uma solicitação, mover para `EM_ANALISE`, agendar, listar o dia, reagendar, concluir e confirmar que `agendado_para` foi preservado. Criar uma segunda solicitação no mesmo horário e confirmar HTTP 200. Confirmar visualmente 320 px, 768 px e desktop, navegação por teclado, foco no resumo de erros e os quatro estados assíncronos.

- [ ] **Step 6: Atualizar Graphify e conferir frescor**

```powershell
& "$env:APPDATA\Python\Python312\Scripts\graphify.exe" update .
git rev-parse HEAD
Select-String -Path graphify-out\GRAPH_REPORT.md -Pattern 'Built from commit'
```

Expected: reconstrução sem erro e relatório apontando para o commit corrente anterior à atualização documental final. `graphify-out` permanece ignorado pelo Git.

- [ ] **Step 7: Registrar evidência e estado das tarefas**

Adicionar uma tarefa explícita de agenda em `TASKS.md` e marcá-la concluída somente após os Steps 3–6. Reescrever `HANDOFF.md` com commits, contagem real dos testes, comandos executados, resultado integrado e qualquer bloqueio verificável.

- [ ] **Step 8: Commit final de documentação**

```powershell
git add docs/spec.md docs/openapi.yaml docs/architecture.md docs/codebase-map.md README.md TASKS.md HANDOFF.md
git commit -m "docs(agenda): consolida contrato e verificacao"
```

---

## Verificação final de aceite

Antes de declarar a feature concluída, conferir no estado real do repositório:

- `AGENDADA` sem `agendado_para` falha no PostgreSQL.
- `RECEBIDA` e `EM_ANALISE` com `agendado_para` falham no PostgreSQL.
- `EM_ANALISE → AGENDADA` sem data ou sem hora retorna 422.
- `RECEBIDA → AGENDADA` com payload completo retorna 409.
- duas solicitações no mesmo instante são aceitas e aparecem na ordem definida.
- reagendamento do mesmo instante é 200 idempotente e não altera `updated_at`.
- concluir ou cancelar preserva o instante histórico.
- consulta diária usa `[início local, próximo início local)` convertido a UTC.
- fila atual e histórico conservam a ordenação anterior.
- formulário mantém valores após falha, associa erros, controla foco e anuncia sucesso.
- URL, paginação e data selecionada da agenda permanecem consistentes.
- Pest, Vitest, TypeScript, lint, build, fluxo integrado e Graphify possuem evidência em `HANDOFF.md`.
