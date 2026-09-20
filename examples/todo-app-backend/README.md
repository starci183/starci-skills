# todo-app-backend

A NestJS domain-first example: sign-in through Keycloak, a Postgres-backed task list scoped by session
token. It owns the example's `.starciwork` and `.starcistacks/dev` (Postgres + Keycloak, realm `todo`,
demo user `demo@todo.dev`) - the runtime's own Work-layout and architecture checks run directly against
this tree, and `examples/todo-app-frontend` is proven against the records here rather than owning its own.

## Continuous verification

`.github/workflows/todo-app-example.yml` runs on every push/PR touching `examples/**`, `schemas/**`,
`scripts/checks/check-example-*.mjs` or `scripts/checks/**`, so the example's evidence comes from a declared GitHub-hosted
runner rather than a developer's laptop:

- **records** - the runtime's own YAML loader and Work-tree layout gate over both example repositories,
  plus the fixture suite behind `scripts/checks/check-example-work.mjs`.
- **backend** - this repository's unit tests and the read-only architecture check (`ok: true` and all six
  backend coverage sections `checked`). The nest scoped-lint profile is wired but guarded off until lane
  `ex-be-nest` brings it clean.
- **frontend** - `examples/todo-app-frontend`'s type-check, unit tests, lint, production build, the
  architecture check (three coverage sections `checked`) and its scoped-lint profile, which must already
  report `status: clean`.
- **live** - brings up this example's real dev stack (Postgres + Keycloak) with the committed DEMO-ONLY
  SOPS secrets, builds and runs the real API and the real Next.js production server, and proves sign-in,
  the uniform wrong-password/unknown-email refusal, the full task lifecycle, CORS and persistence across an
  API process restart with `curl` against the running services - never a mock.
- **uat** - a placeholder that runs the Playwright harness under `examples/todo-app-frontend/uat/` once
  lane `ex-uat-harness` adds it, uploading run evidence (screenshots, video, `result.md`, `run-ledger.json`)
  as CI artifacts.

No job needs a GitHub Actions secret: every credential the stack uses is the committed DEMO-ONLY age
identity at `.starcistacks/dev/runtime/env/demo.agekey` and the `.enc` files it decrypts (see
`scripts/with-dev-secrets.sh` and `.starcistacks/dev/runtime/env/KEYS.md`).

## Probes and metrics

`GET /health` and `GET /ready` answer the dependency-checked Postgres probe (200 ok / 503), and
`GET /metrics` serves Prometheus text exposition of per-route request counters and durations. Every
request carries an `x-request-id` correlation id echoed on the response and written on one structured
`http.request.completed` log line. See `TESTING.md` for the exact commands and how the dev stack's
Prometheus service scrapes the api.
