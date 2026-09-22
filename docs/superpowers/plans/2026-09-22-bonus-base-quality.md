# Bonus Base and Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demonstrate the existing health, migration, logging, seed and architecture bonuses; add CI and measurable accessibility improvements.

**Architecture:** Keep the existing domain Actions and frontend design system. Reconcile seeded records with the new patient/queue/agenda schema, add evidence tests at API and UI boundaries, and run five CI jobs against the same stack. This plan stands alone before authentication.

**Tech Stack:** PHP 8.3, Laravel 11, Pest, PostgreSQL 16, React 18, TypeScript, Vite, Vitest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-22-bonus-desafio-design.md` §§2–3, 5–6, 8.

## Global Constraints

- Preserve existing status transitions, `DB::transaction` + `lockForUpdate`, and the Action as the sole status authority.
- Schema changes use Laravel migrations; PostgreSQL is mandatory for database behavior tests.
- Keep `.env`, credentials and real patient data out of version control; seeders remain fictional and idempotent.
- API failures use `{ message, errors }`; logs contain metadata and request IDs, never patient or credential payloads.
- Keep existing CSS tokens; no new visual framework. Tests mock frontend HTTP; four async UI states remain.
- Preserve the unrelated root checkout files `.codex/` and `backend/composer.lock`.

## Review Focus

- Second `db:seed` run must preserve exactly one active appointment per seeded `AGENDADA` record and one open queue entry per seeded `EM_ANALISE` record; Task 1 pins this.
- PostgreSQL down must make `/api/v1/health` return 503 without exposing connection details; Task 2 pins this.
- Malformed `X-Request-ID` must be replaced by a valid UUID and no request body may reach log context; Task 2 pins this.
- `Tab` and `Shift+Tab` must remain inside the open drill-down, with focus returned on close; Task 3 pins this.
- Fresh CI database must not target the Compose development DB; Task 4 pins this via workflow inspection and job execution.

---

### Task 1: Coherent idempotent demonstration data

**Files:** Modify `backend/database/seeders/SolicitacoesSeeder.php`; test `backend/tests/Feature/SolicitacoesSeederTest.php`; inspect `backend/app/Models/{Agendamento,EntradaFila}.php` and their migrations.

**Interfaces:** Consumes current fixture protocols `SOL-2025-0001` through `0010`; produces seeded patients, requests, two active appointments, and two open queue entries without duplicates.

- [ ] **Step 1: RED.** Add a Pest test that calls `app(SolicitacoesSeeder::class)->run()` twice in the isolated test DB, asserts 10 requests, 10 patients, `AGENDADA` records each have `agendamentoAtivo`, and `EM_ANALISE` records each have one open `EntradaFila`.

```php
$this->seed(SolicitacoesSeeder::class);
$this->seed(SolicitacoesSeeder::class);
expect(Solicitacao::count())->toBe(10);
expect(Solicitacao::where('status', 'AGENDADA')->doesntHave('agendamentoAtivo')->count())->toBe(0);
expect(Solicitacao::where('status', 'EM_ANALISE')->doesntHave('entradaFilaAberta')->count())->toBe(0);
```

- [ ] **Step 2: Verify RED.** Run `docker compose exec -T backend ./vendor/bin/pest tests/Feature/SolicitacoesSeederTest.php`; expected failure is missing appointments/queue entries, not fixture or migration error.
- [ ] **Step 3: GREEN.** After `Solicitacao::firstOrCreate`, call `Agendamento::firstOrCreate(['solicitacao_id' => $solicitacao->id, 'status' => 'AGENDADO'], [...])` only for `AGENDADA`, deriving local date/time/turno from `$agenda` using the existing timezone support. Call `EntradaFila::firstOrCreate(['solicitacao_id' => $solicitacao->id, 'encerrada_em' => null], ['entrou_em' => $solicitacao->created_at])` only for `EM_ANALISE`. Do not change existing records on repeated seeds.
- [ ] **Step 4: Verify GREEN.** Rerun the test, then full Pest and Pint. Expected zero failures. Commit only the seeder/test files: `git commit -m "test: keep demo data coherent and idempotent"`.

### Task 2: Health and request log evidence

**Files:** Test `backend/tests/Feature/{HealthTest,RequestIdTest}.php`; modify `docker-compose.yml` backend service and `backend/config/logging.php`; modify `backend/app/Http/Middleware/RequestId.php` or `backend/bootstrap/app.php` only if tests reveal a defect.

**Interfaces:** Produces public health `200/503`, Docker backend health status, and JSON log context correlated with `X-Request-ID`.

- [ ] **Step 1: RED.** Extend `HealthTest` to assert the 503 response has no exception text. Add `RequestIdTest` cases for a valid UUID retained, an invalid header replaced, and an `api_request` log with method/path/status/duration but no body or CPF. Exercise a real Compose health request and parse its `docker compose logs backend` line as JSON; current `LOG_CHANNEL=stderr` has no declared channel. Inspect `docker compose ps --format json`: backend currently has no health status because Compose has no backend healthcheck.

```php
$response = $this->withHeader('X-Request-ID', 'invalid')->getJson('/api/v1/health');
$response->assertOk()->assertHeader('X-Request-ID');
expect($response->headers->get('X-Request-ID'))->toMatch('/^[0-9a-f-]{36}$/i');
```

- [ ] **Step 2: Verify RED.** Run `docker compose exec -T backend ./vendor/bin/pest tests/Feature/RequestIdTest.php tests/Feature/HealthTest.php` and the real Compose log/health inspection. Existing API assertions may pass; the observed missing JSON channel and health state are the failing acceptance checks for this configuration task.
- [ ] **Step 3: GREEN.** Add a JSON-formatted `stderr` Monolog channel writing `php://stderr`, matching the Compose `LOG_CHANNEL=stderr`. Fix any middleware gap shown by tests. Add to `backend` in `docker-compose.yml` a healthcheck using the image's installed `curl` against `http://127.0.0.1:8000/api/v1/health`, with bounded interval/timeout/retries/start_period.

```yaml
healthcheck:
  test: ['CMD-SHELL', 'curl --fail --silent http://127.0.0.1:8000/api/v1/health >/dev/null']
  interval: 10s
  timeout: 3s
  retries: 3
  start_period: 30s
```

- [ ] **Step 4: Verify GREEN.** Run targeted Pest, full Pest/Pint, `docker compose config`, and check the backend health state without deleting volumes. Commit the exact changed files with `git commit -m "chore: verify health and structured request logs"`.

### Task 3: Keyboard-safe drill-down and responsive audit

**Files:** Modify `frontend/src/features/solicitacoes/components/DrilldownModal.tsx` and `frontend/src/index.css` only as needed; test `frontend/src/test/accessibility.test.tsx`; document findings in `docs/accessibility-review.md`.

**Interfaces:** Open dialog traps Tab/Shift+Tab, Esc closes, focus returns to trigger; existing labels, live regions and CSS tokens continue to work.

- [ ] **Step 1: RED.** Render the real `DrilldownModal` with HTTP mocked at `solicitacoesApi.listar`; focus its close button, send `Shift+Tab`, and assert focus stays in the dialog; close and assert focus returns to the trigger. Add an accessible-name assertion for each icon-only dialog control.

```tsx
await user.keyboard('{Shift>}{Tab}{/Shift}');
expect(dialog).toContainElement(document.activeElement);
await user.keyboard('{Escape}');
expect(trigger).toHaveFocus();
```

- [ ] **Step 2: Verify RED.** Run `npx vitest run src/test/accessibility.test.tsx` in `frontend`; expected failure is focus escaping the open dialog.
- [ ] **Step 3: GREEN.** Handle Tab/Shift+Tab within the dialog's focusable descendants, preserving Esc and cleanup, using native buttons/links. Add only verified CSS fixes for 320/768/desktop, visible focus, 4.5:1 normal text contrast, 44px controls, and reduced motion.
- [ ] **Step 4: Verify GREEN.** Run targeted then full Vitest, `npx tsc --noEmit`, `npm run lint`, `npm run build`; manually inspect keyboard path and widths 320, 768, desktop. Record observed pass/fail per screen in `docs/accessibility-review.md`; do not claim unobserved manual checks. Commit with `git commit -m "fix: keep dashboard dialog keyboard accessible"`.

### Task 4: Five-job CI and architecture evidence

**Files:** Create `.github/workflows/ci.yml`; modify `backend/Dockerfile` only if fresh dependency installation fails; review and track a reproducible `backend/composer.lock`; modify `README.md`, `docs/architecture.md`, `docs/spec.md`, `docs/codebase-map.md`, `TASKS.md`, `HANDOFF.md` as evidence warrants.

**Interfaces:** Workflow job IDs exactly `lint-backend`, `lint-frontend`, `test-backend`, `test-frontend`, `build-frontend`; test job uses `DB_CONNECTION=pgsql_test`, `DB_DATABASE_TEST=vlab_test`, PostgreSQL 16.

- [ ] **Step 1: RED.** Run clean dependency/install, Pint, Pest, Vitest, TypeScript, ESLint, build and `docker compose config` in the worktree. Record any failing command and exact output. If all pass, the missing workflow itself is the failing acceptance condition (no `.github/workflows/ci.yml`).
- [ ] **Step 2: GREEN.** Add workflow with PHP 8.3 and Node 20 setup. Each job uses `actions/cache` keyed by the corresponding lockfile, `composer install` or `npm ci`; `test-backend` has a PostgreSQL 16 service and runs migrations/Pest with the isolated connection. Do not commit the root checkout's untracked lock; generate and inspect a lock in this worktree. Avoid `continue-on-error`.

```yaml
test-backend:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env: { POSTGRES_DB: vlab_test, POSTGRES_USER: vlab, POSTGRES_PASSWORD: test-only }
```

- [ ] **Step 3: Verify.** Parse workflow YAML, run its local commands, and inspect exact job IDs/cache keys/database variables. A remote green run may require a push; report it as unverified until actually observed. Inspect `composer.lock` changes, `git diff --check`, and the full suite. Update README/architecture/spec/map with only verified current behavior. Commit selected files with `git commit -m "ci: validate Laravel and React with PostgreSQL"`.

## Acceptance

Run both full suites, lint/build, and Compose config again after Task 4. Verify the nine-bonus matrix in the spec only for this plan's five existing/quality items. Do not mark CI remotely green without a real Actions run. No `docker compose down -v` on the user's existing project.
