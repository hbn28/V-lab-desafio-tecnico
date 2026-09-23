# Functional audit - operator flow

Date: 2026-09-23. Chrome, Laravel API and PostgreSQL were isolated for this run. All records were synthetic. Operational Docker services and volumes were left untouched.

## Browser scenarios

| Area | Scenario | Result |
| --- | --- | --- |
| Login/authorization | Valid and invalid login, logout, attendant session, denied delete | Passed; denied login is clear, attendant cannot delete, notifications are per-user |
| Create/edit | Invalid submit, synthetic urgent record, edit identity/priority/description | Passed; validation summary appears and creation opens detail |
| Request lifecycle | RECEBIDA -> EM_ANALISE -> AGENDADA -> CONCLUIDA | Passed; status/confirmation updates, completed record cannot be edited |
| Schedule | Turn schedule, detail prefill and exact-time reschedule | Passed |
| Absence/contact | Attempt before end of turn, then record absence after it, record contact result | Passed; early attempt returns 422, contact updates the absence |
| Rebook after absence | Create a new schedule and revisit the previous absence | Passed after fix; historical absence is marked resolved and cannot be rebooked twice |
| Notifications/worker | Per-user read state and real worker job | Passed; worker consumed the job and operator records remained isolated |
| Search/filters | Protocol search in queue, agenda, history and absences; priority/contact filters; default orders | Passed for exercised criteria; queue prioritizes urgency, history is newest first and agenda shows seven daily groups |

## Finding corrected

After rebooking an absence, the old record still displayed Reagendar and some request sequences could reuse that absence. A turn-date label also had an extra comma. Regression tests were added first and observed failing. The action now stamps resultado_em in the transaction, returns 409 on replay, and includes the active schedule in the absence response. The UI retains the historical record as Reagendada without a duplicate rebooking action. Targeted tests and the browser flow now pass.

## Final automated checks

- Frontend: Vitest 67/67; ESLint, tsc --noEmit and Vite production build passed.
- Backend with isolated PostgreSQL 16: Pest 138 tests / 453 assertions; Pint --test passed for 102 files.
- Redocly validated OpenAPI with 0 errors and 3 editorial warnings (license, localhost server and health 4xx response).
- docker compose config --quiet passed without starting/stopping services.
- CI was checked locally; no remote run was observed, so no remote-green claim is made.

## Remaining limits

- Pagination has UI/API test coverage but was not manually navigated with many live pages across all four views. Browser search and filters were exercised, but not every sort direction or date boundary.
- 200% browser zoom, calculated contrast, all touch-target dimensions and screen-reader behavior remain unmeasured; see docs/accessibility-review.md.
- The official edital was not present under tmp/pdf/desafio, so nominal verification of all nine bonuses remains open.

## Graph follow-up

The initial CLI check ran without elevated access and did not find Graphify. With the authorized worktree access, `graphify . --update --code-only` completed: 1072 nodes, 2028 edges and 70 communities. `docs/codebase-map.md` now records these counts. `GRAPH_REPORT.md` was not regenerated because `--code-only` skips documents.

## CI failure follow-up (2026-09-23)

A GitHub Actions run failed only in `UsuariosDemoSeederTest` because the test expected a demo user that the seeder had skipped. The backend CI copies `.env.example`, which preloads empty demo credential entries into `$_SERVER`. The test originally changed `putenv()` and `$_ENV` only; Laravel `env()` kept reading the higher-priority empty server value. I reproduced this with a sanitized `.env.example` overlay: the test failed before the adjustment and passed after setting and restoring `$_SERVER` as well. The seeder behavior did not need a production change.

The full CI-shaped local backend sequence then passed: `php artisan migrate --database=pgsql_test --force`, Pest 138 tests / 453 assertions, and Pint 102 files. The remote failure is confirmed; a rerun after this commit is still needed before calling remote CI green.
