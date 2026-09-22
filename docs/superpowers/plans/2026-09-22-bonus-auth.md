# Bonus Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect the operational API and SPA with cookie sessions and two consistently enforced roles.

**Architecture:** Sanctum authenticates the first-party Vite SPA through Laravel's web session and CSRF cookie. A `SolicitacaoPolicy` authorizes each business operation; the frontend reflects but never decides authorization. The health route stays public.

**Tech Stack:** PHP 8.3, Laravel 11, Sanctum 4, PostgreSQL 16, Pest, React 18, TypeScript, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-bonus-desafio-design.md` §4 and §8. Depends on the base/quality plan.

## Global Constraints

- Do not change the status machine or business Actions; preserve 422/409 domain behavior and `{ message, errors }` for all API errors.
- Public routes: `GET /api/v1/health`, `POST /api/v1/auth/login` and Sanctum's CSRF cookie; every other business route requires an active user.
- Use session cookies and CSRF for the first-party SPA; do not store tokens/passwords in browser storage or commit secrets.
- Roles are `ADMINISTRADOR` and `ATENDENTE`; delete is administrator-only; all other listed operations permit both.
- Keep existing frontend visual tokens, visible labels, loading/error states, and user-facing Portuguese copy.

## Review Focus

- An inactive user with an old cookie must receive 403 on every protected request; Task 2 pins this.
- A signed-in attendant must be denied delete even if they call the API directly; Task 2 pins this.
- Incorrect email and incorrect password must yield the same public error; Task 1 pins this.
- An expired cookie must take the SPA to login while retaining an understandable message; Task 3 pins this.
- Login must work behind Vite's same-origin proxy with CSRF; Task 3 includes a real-browser smoke path.

---

### Task 1: User persistence and session endpoints

**Files:** Modify `backend/composer.json` and generated `backend/composer.lock`; create migration `backend/database/migrations/2026_09_22_000007_create_users_table.php`, `backend/app/Models/User.php`, `backend/database/factories/UserFactory.php`, `backend/app/Domain/Auth/Http/{LoginRequest.php,AuthController.php}`; modify `backend/bootstrap/app.php`, `backend/routes/api.php`, `backend/config/cors.php`, `frontend/vite.config.ts`; test `backend/tests/Feature/AuthTest.php`.

**Interfaces:** `POST /api/v1/auth/login` takes email/password and returns `{data:{id,name,email,role}}`; `GET /api/v1/auth/me` returns the same shape; `POST /api/v1/auth/logout` invalidates the session. `User::is_active` and `role` back the policy in Task 2.

- [ ] **Step 1: RED.** Add tests for successful session login, identical public failure for unknown email/wrong password, inactive login rejection, `me` only while signed in, and logout invalidation. The success test creates a fake user with a hashed password and posts JSON; assert no `password` or `remember_token` key in the response.

```php
$user = User::factory()->create(['role' => 'ATENDENTE', 'password' => Hash::make('local-test-pass')]);
$this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'local-test-pass'])
    ->assertOk()->assertJsonPath('data.role', 'ATENDENTE')->assertJsonMissingPath('data.password');
$this->getJson('/api/v1/auth/me')->assertOk();
```

- [ ] **Step 2: Verify RED.** Run `docker compose exec -T backend ./vendor/bin/pest tests/Feature/AuthTest.php`; expected failure is missing endpoint/model, not a test setup error.
- [ ] **Step 3: GREEN.** Install Sanctum 4 through Composer; add User migration with unique email and CHECK on role, model `Authenticatable` and factory. Use `Auth::attempt`, regenerate session, return only public fields, invalidate on logout. Register `statefulApi()` and explicit 401/403/419 JSON renderers before the generic 500 renderer. Configure `SESSION_DRIVER=file`, a stable `APP_KEY`, host-only cookie domain, and `SANCTUM_STATEFUL_DOMAINS=localhost:5173,localhost:8000` for Compose; configure CORS credentials and proxy `/sanctum` to backend. Set throttling on login.
- [ ] **Step 4: Verify GREEN.** Run targeted Pest, full Pest/Pint, and `docker compose config`; inspect actual `Set-Cookie` and CSRF flow through the browser proxy. Commit exact files with `git commit -m "feat: add first-party session login"`.

### Task 2: Policy on every operational endpoint

**Files:** Create `backend/app/Policies/SolicitacaoPolicy.php`, `backend/app/Http/Middleware/EnsureActiveUser.php`; modify `backend/routes/api.php`, `backend/app/Domain/Solicitacoes/Http/Controllers/SolicitacaoController.php`, `backend/tests/TestCase.php`; test `backend/tests/Feature/AuthorizationTest.php`; adjust existing backend feature tests only where authentication setup requires it.

**Interfaces:** Policy methods `viewAny(User $user)`, `view(User $user, Solicitacao $solicitacao)`, `create(User $user)`, `update(User $user, Solicitacao $solicitacao)`, `delete(User $user, Solicitacao $solicitacao)`; `EnsureActiveUser::handle` rejects inactive users. Controller authorizes every route, including fila/faltas and agendamento/falta mutations.

- [ ] **Step 1: RED.** Test anonymous GET `/api/v1/solicitacoes` is 401; attendant delete is 403 and row remains; administrator delete is 204; inactive user with an authenticated session is 403. Cover at least one route for each grouped operation (read, create, status, appointment, fault contact).

```php
$solicitacao = Solicitacao::factory()->create();
$this->actingAs(User::factory()->create(['role' => 'ATENDENTE']))
    ->deleteJson("/api/v1/solicitacoes/{$solicitacao->id}")->assertForbidden();
expect($solicitacao->fresh())->not->toBeNull();
```

- [ ] **Step 2: Verify RED.** Run `docker compose exec -T backend ./vendor/bin/pest tests/Feature/AuthorizationTest.php`; expected unauthorized access currently succeeds or no Policy is invoked.
- [ ] **Step 3: GREEN.** Put business routes in `auth:sanctum` plus active-user middleware. Call `Gate::authorize` or `$this->authorize` before Action invocation; use Policy for each operation, including the resource bound through agendamento. Preserve the controller's FormRequest → Action → Resource path. Update the test base to use an administrator for preexisting domain feature tests, while dedicated auth tests explicitly clear authentication for anonymous cases.
- [ ] **Step 4: Verify GREEN.** Run targeted and full Pest/Pint, asserting all existing business tests still exercise their Actions. Commit with `git commit -m "feat: enforce operator roles across API"`.

### Task 3: SPA login, logout and protected navigation

**Files:** Create `frontend/src/features/auth/{api/client.ts,types.ts,AuthProvider.tsx,LoginPage.tsx,ProtectedRoute.tsx}`; modify `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/features/solicitacoes/api/client.ts`, `frontend/src/features/solicitacoes/pages/SolicitacaoDetailPage.tsx`, `frontend/src/index.css`; test `frontend/src/test/auth.test.tsx` and adapt existing tests only for new context boundaries.

**Interfaces:** `authApi.login(email,password)`, `authApi.me()`, `authApi.logout()` consume the API shapes from Task 1; `useAuth()` exposes `{user,loading,error,login,logout}`; the API client sends `credentials:'include'` and XSRF header for mutating requests.

- [ ] **Step 1: RED.** With auth HTTP mocked, test anonymous entry shows `LoginPage`, successful login reaches dashboard, logout returns to login, expired session displays a helpful prompt, and the delete control is absent for `ATENDENTE` but present for `ADMINISTRADOR`.

```tsx
render(<App />);
expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument();
await userEvent.type(screen.getByLabelText(/e-mail/i), 'atendente@example.test');
await userEvent.type(screen.getByLabelText(/senha/i), 'local-test-pass');
await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
expect(await screen.findByRole('navigation', { name: /principal/i })).toBeInTheDocument();
```

- [ ] **Step 2: Verify RED.** Run `npx vitest run src/test/auth.test.tsx`; expected failure is unprotected route/missing login view.
- [ ] **Step 3: GREEN.** Implement AuthProvider and protected route; login fields use labels, `autoComplete=email/current-password`, paste enabled and inline errors. `fetch` sends same-origin cookies; before login request `/sanctum/csrf-cookie`, read `XSRF-TOKEN` cookie and send decoded `X-XSRF-TOKEN` for POST/PUT/PATCH/DELETE. Display role and logout in Layout; hide delete for attendants. Handle 401/403/419 without exposing technical details.
- [ ] **Step 4: Verify GREEN.** Run targeted/full Vitest, TypeScript, lint and build. In a real browser behind Vite proxy, check login, refresh persistence, forbidden delete via direct API, logout, and 320px keyboard flow. Commit with `git commit -m "feat: add accessible operator sign-in"`.

### Task 4: Local operator seed and contract docs

**Files:** Create `backend/database/seeders/UsuariosDemoSeeder.php`; modify `backend/database/seeders/DatabaseSeeder.php`, `backend/.env.example`, `README.md`, `docs/spec.md`, `docs/openapi.yaml`, `docs/architecture.md`, `docs/codebase-map.md`, `TASKS.md`, `HANDOFF.md`; test `backend/tests/Feature/UsuariosDemoSeederTest.php`.

**Interfaces:** Seeder reads `DEMO_ADMIN_EMAIL/PASSWORD` and `DEMO_ATTENDANT_EMAIL/PASSWORD` only in local/testing; skips absent pairs, hashes supplied passwords and never overwrites an existing hash.

- [ ] **Step 1: RED.** With fake local env values, run the seeder twice and assert exactly two users, correct roles, hash verification and unchanged hashes after second run. Under production env, assert no users created.

```php
$this->seed(UsuariosDemoSeeder::class);
$this->seed(UsuariosDemoSeeder::class);
expect(User::where('role', 'ADMINISTRADOR')->count())->toBe(1);
expect(Hash::check('demo-test-pass', User::where('role', 'ADMINISTRADOR')->firstOrFail()->password))->toBeTrue();
```

- [ ] **Step 2: Verify RED.** Run `docker compose exec -T backend ./vendor/bin/pest tests/Feature/UsuariosDemoSeederTest.php`; expected failure is missing seeder.
- [ ] **Step 3: GREEN.** Implement the gated idempotent seeder, add empty credential placeholders to `.env.example`, and update API/architecture/README documentation with cookie/CSRF, role table, 401/403/419, local credential setup and limitations. Do not put an actual credential in docs or Compose.
- [ ] **Step 4: Verify GREEN.** Run targeted and full Pest/Pint, OpenAPI lint, Vitest/lint/build, and a local login smoke test configured with temporary credentials. Update ignored `TASKS.md`/`HANDOFF.md` with evidence. Commit tracked files with `git commit -m "docs: describe operator access and local demo setup"`.

## Acceptance

Confirm all business routes require an active session, all Policy decisions occur server-side, health/login remain public, session survives refresh and ends on logout, and no credential is committed. Run complete backend/frontend checks and preserve the unchanged status machine.
