# Source tree (BE) — the physical map

Where things sit in `starci-academy-backend/src`. An ORIENTATION map that points to the docs that own
the rules — the authority is [`enforce/authoring/naming-and-structure.md`](enforce/authoring/naming-and-structure.md)
§3, the staged target in `.artifacts/states/_modules/structure.md`, and `src/modules/README.md`. This
file does not restate those; it is the tree at a glance.

## `src/` top level

```
src/
├─ modules/     the shared library (`@modules/*`) — tiered, see below
└─ features/    app-composition / runnable features — DISTINCT from modules/
```

- **`modules/` vs `features/`**: `modules/` is the reusable library any feature leans on; `features/` is
  the runnable/composed side — `api` (the app), `cli`, `backup`, `socketio`, `video-encoder`, `mock`,
  `tools`. A library goes in `modules/`; a deployable/runnable thing goes in `features/`.

## `src/modules/` — tiered library (`@modules/<name>`)

```
modules/
├─ integrations/  an adapter to something OUTSIDE the process
│                 (sepay·payos·stripe·paypal·nowpayments·kafka·elasticsearch·s3·cache·keycloak·
│                  github·googleapis·langchain·rag·judge0·mailer·sentry·captcha·totp·bullmq·ffmpeg…)
├─ platform/      a framework / cross-cutting concern every feature leans on
│                 (cqrs·env·event·exceptions·projection·logger·throttler·cors·cookie·csrf·helmet·
│                  session·passport·health·routing·locale·client-context·socketio)
├─ bussiness/     the business domains (30 modules) — `@modules/bussiness/<domain>`
├─ data/          databases (entities + data sources)
├─ lib/           leaf utilities, no framework or domain weight (common·mixin·native·validators·assets)
└─ ai/ crypto/ filesystem/ api/ init/ tests/ docs/ membership/ playground-agent-core/
                  still flat at the root — borderline or app-composition, not moved (see README)
```

- The `@modules/*` alias is a **single root** (tsconfig + jest): `@modules/<path>` is
  `src/modules/<path>`, file and all. Meta-category modules keep the category segment
  (`@modules/platform/winston/winston.service`, not `@modules/winston/...`). File paths are public
  API — moving a file or a module between tiers churns every importer. A NEW module is created
  directly inside its tier folder.
- ⚠️ **`bussiness` is spelt that way ON PURPOSE — it stays.** Do not "fix" it.
- The rule a machine holds is `enforce/authoring/naming-and-structure.md` §3; the target + staged move
  plan is `.artifacts/states/_modules/structure.md`.

## Errors

Always `throw` an `AbstractException` subclass — never `new Error(...)` and never a raw Nest `*Exception`.
A global `APP_FILTER` + optional `httpStatus?` maps it for HTTP, and `formatError` maps it for GraphQL.
See the exception-handling canon under `enforce/`.
