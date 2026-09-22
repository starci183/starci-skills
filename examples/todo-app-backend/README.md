# todo-app-backend

A NestJS domain-first example: sign-in through Keycloak, a Postgres-backed task list scoped by session
token. It owns the example's `.starciwork` and `.starcistacks/dev` (Postgres + Keycloak, realm `todo`,
demo user `demo@todo.dev`) - the runtime's own Work-layout and architecture checks run directly against
this tree, and `examples/todo-app-frontend` is proven against the records here rather than owning its own.

## Continuous verification

`.github/workflows/todo-app-example.yml` runs on every push/PR touching `examples/**`, `packages/**`,
`modules/schemas/**` or `scripts/checks/**`, so the example's evidence comes from a declared GitHub-hosted
runner rather than a developer's laptop:

- **records** - the runtime's own YAML loader and Work-tree layout gate over both example repositories,
  plus the fixture suite behind `scripts/checks/check-example-work.mjs`.
- **backend** - this repository's type-check, unit tests and the `nest` scoped-lint gate
  (`scripts/checks/check-scoped-lint.mjs`), which carries the architecture check as one of its machine
  kinds and whose exit code is the verdict: `0` clean, `1` findings, `2` unavailable.
- **frontend** - `examples/todo-app-frontend`'s type-check, unit tests, lint, production build and the
  same gate on the `next` profile.
- **live** - brings up this example's real dev stack (Postgres + Keycloak) with the committed DEMO-ONLY
  SOPS secrets, builds and runs the real API and the real Next.js production server, proves sign-in,
  the uniform wrong-password/unknown-email refusal, the full task lifecycle, CORS and persistence across an
  API process restart with `curl` against the running services - never a mock - and then runs the
  Playwright UAT flows (`examples/todo-app-frontend/uat`) against that same stack, uploading each run's
  `manifest.yaml`, `result.md`, screens and videos from the Work tree here as CI artifacts.

No job needs a GitHub Actions secret. `.starcistacks/dev/runtime/env/demo.agekey` is a demo key committed
on purpose: it encrypts demo values only - every `.enc` file it opens holds a placeholder string, never a
real credential - which is exactly why nothing real may ever be encrypted to it (see
`scripts/with-dev-secrets.sh` and `.starcistacks/dev/runtime/env/KEYS.md`).

## Probes and metrics

`GET /health` and `GET /ready` answer the dependency-checked Postgres probe (200 ok / 503), and
`GET /metrics` serves Prometheus text exposition of per-route request counters and durations. Every
request carries an `x-request-id` correlation id echoed on the response and written on one structured
`http.request.completed` log line. See `TESTING.md` for the exact commands and how the dev stack's
Prometheus service scrapes the api.
