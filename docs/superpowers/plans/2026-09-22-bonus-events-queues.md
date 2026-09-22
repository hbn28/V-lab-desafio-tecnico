# Bonus Events and Queues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn committed status transitions into retryable, idempotent in-app operator notifications processed by a separate worker.

**Architecture:** The existing status Action emits an after-commit domain event. A queued listener writes one notification per active user with a unique `(event_id,user_id)` constraint. Authenticated API routes and a small header panel expose the user's own notifications.

**Tech Stack:** PHP 8.3, Laravel 11 Events/Queues, PostgreSQL 16 database queue, Pest, Docker Compose, React 18, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-bonus-desafio-design.md` §7 and §8. Depends on operator users and protected API from the auth plan.

## Global Constraints

- `AtualizarStatusSolicitacao` is the only status authority; keep its transaction and `lockForUpdate`.
- Event payload and worker logs include event/request IDs, protocol and statuses only; no patient name, CPF, phone, clinical description or credentials.
- Queue failure never changes a successful status response; a rollback never leaves a job.
- PostgreSQL migrations define `jobs`, `failed_jobs` and notifications; `(event_id,user_id)` makes retries idempotent.
- Notification reads and marks are scoped to the authenticated user on the server.
- Keep the first-party cookie/CSRF auth and frontend's four async states.

## Review Focus

- A failed status transition must leave neither job nor notification; Task 1 pins this.
- Retrying the same event must not create a second row for a user; Task 1 pins this.
- An inactive user must never receive a new notification; Task 1 pins this.
- A caller must not read or mark another user's notification, even with its ID; Task 2 pins this.
- Worker timeout must be lower than database queue `retry_after`, and a failed job must be visible/retryable; Task 3 verifies this.

---

### Task 1: Event, database queue and idempotent listener

**Files:** Create `backend/database/migrations/2026_09_22_000008_create_jobs_and_notifications_tables.php`, `backend/app/Models/NotificacaoOperacional.php`, `backend/app/Domain/Solicitacoes/Events/SolicitacaoStatusAtualizado.php`, `backend/app/Domain/Solicitacoes/Listeners/CriarNotificacoesOperacionais.php`; modify `backend/app/Domain/Solicitacoes/Actions/AtualizarStatusSolicitacao.php`, `backend/app/Providers/AppServiceProvider.php`, `backend/config/queue.php`, `backend/.env.example`; test `backend/tests/Feature/NotificacaoStatusTest.php`.

**Interfaces:** Event carries `eventId`, `requestId`, `solicitacaoId`, `protocolo`, `statusAnterior`, `statusNovo`; listener implements `ShouldQueue`, writes notifications for `User::where('is_active', true)`; queue connection `database` has `after_commit=true`, `retry_after=90`.

- [ ] **Step 1: RED.** Test a committed `RECEBIDA→EM_ANALISE` emits one queued event; invalid transition/rollback emits none. With one active and one inactive user, process the listener twice with the same event ID and assert exactly one notification for the active user with only safe fields.

```php
$event = new SolicitacaoStatusAtualizado(
    eventId: (string) Str::uuid(), requestId: null,
    solicitacaoId: $solicitacao->id, protocolo: $solicitacao->protocolo,
    statusAnterior: 'RECEBIDA', statusNovo: 'EM_ANALISE'
);
app(CriarNotificacoesOperacionais::class)->handle($event);
app(CriarNotificacoesOperacionais::class)->handle($event);
expect(NotificacaoOperacional::where('user_id', $active->id)->count())->toBe(1);
```

- [ ] **Step 2: Verify RED.** Run `docker compose exec -T backend ./vendor/bin/pest tests/Feature/NotificacaoStatusTest.php`; expected failure is missing event/listener/tables, not a malformed fixture.
- [ ] **Step 3: GREEN.** Add migrations and model; event implements `ShouldDispatchAfterCommit`. Emit inside the Action's transaction after persistence, capturing prior status under lock. Register listener in AppServiceProvider, set database queue configuration, and insert notifications with database-level conflict handling on `(event_id,user_id)`. Listener logs success/failure metadata with `event_id` and `request_id` and rethrows failures for retry; no payload log. Set `tries=3` and `backoff=5` on listener or worker, not unlimited retries.
- [ ] **Step 4: Verify GREEN.** Run targeted Pest, full Pest/Pint. Add an integration test using a separate PostgreSQL test transaction boundary that runs `queue:work database --once`, then verifies the persisted notification; do not use an outer `RefreshDatabase` transaction when asserting after-commit dispatch. Commit with `git commit -m "feat: queue status notifications after commit"`.

### Task 2: User-scoped notification API

**Files:** Create `backend/app/Domain/Notificacoes/Http/Controllers/NotificacaoController.php`, `backend/app/Domain/Notificacoes/Http/Resources/NotificacaoResource.php`; modify `backend/routes/api.php`; test `backend/tests/Feature/NotificacaoApiTest.php`.

**Interfaces:** `GET /api/v1/notificacoes` returns `{data:[{id,protocolo,status_anterior,status_novo,solicitacao_id,created_at,read_at}],unread_count}`; `PATCH /api/v1/notificacoes/{id}/lida` marks a row only when `user_id` equals the authenticated user and returns `{data:...}`.

- [ ] **Step 1: RED.** Create notifications for two users. Authenticate as first; GET must expose only their row and unread count 1; PATCH other user's ID must return 404 without changing it; PATCH own ID must set `read_at`; anonymous request must return 401.

```php
$this->actingAs($first)->patchJson("/api/v1/notificacoes/{$otherNotification->id}/lida")
    ->assertNotFound();
expect($otherNotification->fresh()->read_at)->toBeNull();
```

- [ ] **Step 2: Verify RED.** Run `docker compose exec -T backend ./vendor/bin/pest tests/Feature/NotificacaoApiTest.php`; expected route 404 or unauthorized scope failure.
- [ ] **Step 3: GREEN.** Put both routes inside active `auth:sanctum` group; query `where('user_id', $request->user()->id)` before finding/marking. Limit list to recent 20, newest first; compute unread count in a separate scoped query. Resource returns only safe fields, never patient data.
- [ ] **Step 4: Verify GREEN.** Run targeted/full Pest/Pint and check OpenAPI shape against actual JSON. Commit with `git commit -m "feat: expose private operator notifications"`.

### Task 3: Worker service and failure operation

**Files:** Modify `docker-compose.yml`, `backend/docker/entrypoint.sh` only if needed to share migration readiness safely, `README.md`, `docs/architecture.md`, `docs/spec.md`, `docs/openapi.yaml`, `docs/codebase-map.md`, `TASKS.md`, `HANDOFF.md`; test `backend/tests/Feature/NotificacaoQueueTest.php`.

**Interfaces:** Worker executes `php artisan queue:work database --tries=3 --backoff=5 --timeout=30`; database connection has `retry_after=90`, `after_commit=true`. The API container alone runs migrations; worker waits for backend healthy before starting.

- [ ] **Step 1: RED.** Add an integration test that dispatches a status transition with `QUEUE_CONNECTION=database`, observes one `jobs` row before worker execution, runs `queue:work database --once`, and sees notification persistence. Add a failure test with a deliberately throwing listener dependency or controlled exception to show failed job remains inspectable after max tries.

```php
config()->set('queue.default', 'database');
$this->artisan('queue:work', ['connection' => 'database', '--once' => true, '--tries' => 3])
    ->assertExitCode(0);
expect(NotificacaoOperacional::where('solicitacao_id', $solicitacao->id)->exists())->toBeTrue();
```

- [ ] **Step 2: Verify RED.** Run `docker compose exec -T backend ./vendor/bin/pest tests/Feature/NotificacaoQueueTest.php`; expected failure is no queued job/worker processing.
- [ ] **Step 3: GREEN.** Add `worker` service reusing backend image, environment and vendor volume, no host port, health dependency and the exact queue command; avoid running the HTTP entrypoint in the worker by overriding entrypoint/command deliberately. Document `queue:failed`, `queue:retry <id>`, retry window, and post-commit notification-loss limitation. Update diagrams and API contract.
- [ ] **Step 4: Verify GREEN.** Run targeted/full Pest/Pint, `docker compose config`, observe worker processing in an isolated Compose project, then verify API status response remains successful if worker is stopped. Commit with `git commit -m "ops: run and document database queue worker"`.

### Task 4: Accessible notifications in the SPA

**Files:** Create `frontend/src/features/notificacoes/{api/client.ts,types.ts,components/NotificacoesPanel.tsx}`; modify `frontend/src/components/Layout.tsx`, `frontend/src/index.css`; test `frontend/src/test/notificacoes.test.tsx`.

**Interfaces:** API methods `listar(): Promise<ListaNotificacoes>` and `marcarLida(id:number): Promise<Notificacao>` consume Task 2 JSON; Layout shows count, panel list and links to `/solicitacoes/:id`.

- [ ] **Step 1: RED.** Test loading, empty, error/retry and populated states with HTTP mocked; count is announced as a complete phrase; keyboard opens panel, follows a notification link and marks own notification read. Assert no patient PII is rendered.

```tsx
await userEvent.click(screen.getByRole('button', { name: /notificações/i }));
expect(await screen.findByRole('link', { name: /SOL-2025-0001/i }))
  .toHaveAttribute('href', '/solicitacoes/1');
```

- [ ] **Step 2: Verify RED.** Run `npx vitest run src/test/notificacoes.test.tsx`; expected failure is missing panel/control.
- [ ] **Step 3: GREEN.** Add a semantic button with `aria-expanded`/`aria-controls`, a list of links, keyboard dismissal and visible focus. Fetch only while authenticated; expose retry and empty state. Keep styles within existing design tokens and responsive header layout.
- [ ] **Step 4: Verify GREEN.** Run targeted/full Vitest, TypeScript, lint and build; manually inspect 320/768/desktop and keyboard navigation. Commit with `git commit -m "feat: show accessible operator notifications"`.

## Acceptance

Run full backend/frontend suites, lint/build, OpenAPI lint and an isolated end-to-end status transition with worker. Inspect logs and queued payload for PII. Document the lack of an outbox and do not claim remote CI green until observed. Update `TASKS.md` and `HANDOFF.md` with actual evidence only.
