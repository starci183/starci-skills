# v8-2 lane report — `scripts/check-work-surfaces.mjs` (declared-vs-served surface diff)

Scope: one new file, `.claude/scripts/check-work-surfaces.mjs`, plus its fixture spec
`tests/work-surfaces.spec.mjs`. No existing script, record or `.starciwork` tree was edited.

## What it checks

Walks the example `.starciwork` trees (or `--tree <path>`) and diffs, in both directions, the
surfaces the records *declare* against the surfaces the bound repositories *serve*:

- **HTTP**: every NestJS `@Controller` prefix + `@Get/@Post/.../@All` method (bare decorators and
  option arguments included) vs every `METHOD /path` a `work/contract`'s `surface` declares —
  whether as a `{method, path}` http item or as `GET /x` prose inside shape/transport/requests
  text. `work/integration` `endpoints[]` count as declarations (they claim inbound doors like
  `POST /webhooks/sepay`); an unserved one is INFO `INTEGRATION_ENDPOINT_REMOTE`, never REFUSE,
  because the provider's own API is a wire no controller could serve.
- **GraphQL**: `src/**/graphql/{queries,mutations}/<cap>/<op>/` directories merged with
  `@Query/@Mutation` decorated methods (balanced-paren argument scan, so `() => Type` signatures
  survive). A decorated method and an op dir are the same operation when the resolver file sits
  inside the dir — the explicit `name:` wins over the directory's camel (`list-tasks` is the
  folder, `tasks` is the wire). Compared against contract surfaces (strict + loose patterns) and
  impl `proves` coverage.
- **Frontend**: `src/app/**/page.tsx` (plus `apps/<app>/src/app/...` in npm-workspace monorepos)
  vs `work/ui-screen`'s `surfaces[].route`/`entry` claims. `[lang]` is normalized away; other
  `[param]` segments become positional. URL claims are pinned to an app through
  `metadata.json`'s `ports` projection (`localhost:3069` → `apps/landing`).
- **Events**: `class XxxEvent` declarations paired with their own `kind = "event.*"` literal
  (bounded to the class body), `new XxxEvent(` construction in **non-spec** files (emission), and
  `instanceof`/`@EventsHandler`/`subscribe` handling — diffed against `work/event` records and
  feature-level `subscribes`, aggregated per feature so two subscriber files in one feature don't
  flag each other.
- **proves coverage**: a contract-declared route/op that is served but named by no impl's
  `proves` is SUSPECT `CONTRACT_ROUTE_UNPROVEN` / `CONTRACT_OP_UNPROVEN` — the wire exists in
  contract and code, yet no implementation claims it.
- Output: `SURFACE MAP` per repository (route/op/page/event counts vs claimed counts), findings
  grouped REFUSE/SUSPECT/INFO, exit 1 on any REFUSE.

## Design decisions

- **Severity follows check-work-deep's discipline**: REFUSE only when a `done` record asserts a
  surface nothing serves (deterministically wrong). A `todo` record's unserved surface is
  SUSPECT — the door may legitimately be unbuilt; a `todo`+`blockedBy` unemitted event is INFO —
  the record already says so (`event.login.new-device-signin` is the live example).
- **Ops doors are INFO, never contract failures**: `/health`-class routes
  (`health|healthz|ready|readyz|live|livez|metrics|...`, path-segment bounded) are real but no
  contract could own them.
- **Emission is judged on production files only**: the bus spec suite constructs every event
  class including `NewDeviceSigninEvent`, which no use case publishes — counting spec
  construction as emission would report exactly the lie this check exists to catch.
- **Contract GraphQL names come in two tiers**: strict patterns (name position unambiguous —
  `orderDetail GraphQL query`) are ghost-eligible; loose patterns (`GraphQL query <word>`) are
  claim material only. Prose like "the GraphQL query composes the read" produced a
  `CONTRACT_GHOST_OP` on the word *composes* in the first run — the fix, not a suppressed
  finding. A stopword list (`schema`, `resolver`, `operation`, ...) rejects prose nouns in name
  position.
- **Route params compare positionally**: `/internal/buyers/:personId` = `/internal/buyers/:id` —
  parameter *names* are contract prose, positions are the wire. Methods and trailing slashes are
  normalized the same way.
- **Event-class binding prefers the `kind` discriminant** (`kind = 'event.login.signed-in'` is
  the honest binding); the id-shaped class-name guesses (`SignedInEvent` drops the feature
  segment, `TaskDeletedEvent` keeps it) are fallback only.
- **A subscriber file answers to its feature's union of `subscribes`**, resolved by record
  ownership of the file's directory, with `modules/bussiness/<feature>/` path-segment fallback
  for the todo backend's unowned module layout.
- Reuse, per `_common.md`: `parseYaml` (core/yaml), `walk` (check-example-work),
  `loadRecords`/`resolveOwnedDirs`/`repoRootFor`/`readWorkspace` (example-ownership) — so owned
  dirs, repo topology and prover-fallback resolve identically to the existing checks.

## Live findings (verbatim)

`node scripts/check-work-surfaces.mjs --tree examples/todo-app-backend/.starciwork`
→ `2 refused, 14 suspect, 6 info`, exit 1:

```
SURFACE MAP
  todo-app-backend: 2 http route(s) (1 declared, 0 owned-only); 27 graphql op(s), 14 claimed; 6 event class(es), 5 emitted, 2 subscriber file(s)
  todo-app-frontend: 0 http route(s) (0 declared, 0 owned-only); 10 fe route(s), 5 ui-claimed
  6 work/event record(s) (3 done), 5 emitted, 2 feature(s) declaring subscribes
  270 record(s) total; 0 contract http declaration(s), 5 integration endpoint(s), 0 contract graphql declaration(s), 7 ui route claim(s)
```

Both REFUSEs are verified true positives — `done` ui-screens claiming routes nothing serves,
while their own impl records own *different* route dirs (`[lang]/recur`, `[lang]/audit`):

```
REFUSE  examples/todo-app-backend/.starciwork/features/audit/ui/privacy/index.yaml: ui.audit.privacy claims route /privacy (as /privacy) but no page.tsx serves it in any bound fe repository - a screen the record says exists that no route reaches [UI_ROUTE_GHOST]
REFUSE  examples/todo-app-backend/.starciwork/features/recur/ui/schedule/index.yaml: ui.recur.schedule claims route /tasks/:taskId/schedule (as /tasks/:_/schedule) but no page.tsx serves it in any bound fe repository - a screen the record says exists that no route reaches [UI_ROUTE_GHOST]
```

Representative SUSPECTs (7 unclaimed op groups, 5 unclaimed fe routes, 2 subscription diffs):

```
SUSPECT examples/todo-app-backend/src/features/todo/graphql/queries/task/list-tasks: graphql queries/task serves 2 op(s) no record owns or names: tasks, taskCounts - protocol adaptation is thin, but a shipped door should still be explained [UNDECLARED_OPERATION]
SUSPECT examples/todo-app-frontend/src/app/[lang]/plan/page.tsx: route /plan is served but no ui-screen's surfaces[].route claims it [UI_ROUTE_UNDECLARED]
SUSPECT examples/todo-app-backend/src/modules/bussiness/notify/notify-event.subscriber.ts: notify's subscribers (notify-event.subscriber.ts) handle event.login.signed-in, but no notify record's subscribes names it [SUBSCRIPTION_UNDECLARED]
SUSPECT examples/todo-app-backend/src/modules/bussiness/notify/notify-event.subscriber.ts: notify's records subscribe to event.login.new-device-signin, but its subscribers (notify-event.subscriber.ts) never handle it - a declared subscription with no code behind it [SUBSCRIPTION_NOT_WIRED]
```

And the honest INFOs — the blocked event explaining itself, and provider-side endpoints:

```
INFO    examples/todo-app-backend/.starciwork/features/login/event/new-device-signin/index.yaml: event.login.new-device-signin maps to event class LoginNewDeviceSigninEvent/NewDeviceSigninEvent, but nothing under src/ publishes it - the record describes an event nothing emits; the record itself says so (todo, blockedBy gap.login.device-field) [EVENT_UNEMITTED]
INFO    examples/todo-app-backend/src/features/todo/http/health/health.controller.ts: GET /health is an ops/probe door - real, but no contract could ever own it [OPS_ROUTE]
```

`node scripts/check-work-surfaces.mjs --tree examples/ecommerce-app-be/.starciwork`
→ `0 refused, 3 suspect, 2 info`, exit 0:

```
SURFACE MAP
  ecommerce-app-be: 5 http route(s) (1 declared, 4 owned-only); 7 graphql op(s), 7 claimed
  ecommerce-app-fe: 0 http route(s) (0 declared, 0 owned-only); 6 fe route(s), 5 ui-claimed
  41 record(s) total; 1 contract http declaration(s), 0 integration endpoint(s), 1 contract graphql declaration(s), 5 ui route claim(s)

SUSPECT examples/ecommerce-app-be/src/features/identity/transport/http/session.controller.ts: POST /internal/sessions/verify served by session.controller.ts is owned by fr.identity.sign-in but declared by no contract or integration endpoint - a wire between features with no record of its shape [UNDECLARED_ROUTE]
SUSPECT examples/ecommerce-app-be/src/features/identity/transport/http/session.controller.ts: POST /internal/sessions/revoke served by session.controller.ts is owned by fr.identity.sign-in but declared by no contract or integration endpoint - a wire between features with no record of its shape [UNDECLARED_ROUTE]
SUSPECT examples/ecommerce-app-fe/apps/shop/src/app/[lang]/page.tsx: apps/shop route / is served but no ui-screen's surfaces[].route claims it [UI_ROUTE_UNDECLARED]
INFO    examples/ecommerce-app-be/src/features/checkout/transport/http/health.controller.ts: GET /health is an ops/probe door - real, but no contract could ever own it [OPS_ROUTE]
INFO    examples/ecommerce-app-be/src/features/identity/transport/http/health.controller.ts: GET /health is an ops/probe door - real, but no contract could ever own it [OPS_ROUTE]
```

Combined run (`node scripts/check-work-surfaces.mjs`): `2 refused, 17 suspect, 8 info`.

## False-positive rate observed

Final state: **0 REFUSE false positives** — both refusals verified against the impl records that
own the real route dirs. All SUSPECTs are heuristic-by-design true observations (a served door no
record names, a declared subscription no code wires); none was a misparse.

Three genuine false positives were found and fixed during development, worth recording because
they show where extraction lies:

- `CONTRACT_GHOST_OP` on the prose word *composes* ("the GraphQL query composes …") — fixed by
  the strict/loose pattern split described above.
- Duplicate/phantom operation groups — `'queries'.slice(0,-1)` produced kind `querie`, so
  dir-ops and decorated ops never deduplicated; fixed with an explicit `queries → query` map and
  resolver-file-location merging (which also correctly prefers the wire name `tasks` over the
  folder camel `listTasks`).
- Event emission counted spec files — the bus specs construct `NewDeviceSigninEvent`, which no
  production code emits; emission is now judged on non-spec files only, and each class's `kind`
  literal is bounded to its own body.

Remaining heuristic caveats (SUSPECT-tier by design): `subscribes` is compared per feature, so a
record in feature X whose handler lives under another feature's directory would report a gap;
contract prose mentioning an op name loosely can claim a served op it did not formally declare.

## Deliberately not checked

- **No payload/schema diffing**: a served route whose response shape diverges from the
  contract's `shape` prose is out of scope — the check compares *doors*, not payloads.
- **No `@All`-vs-method mismatch**: `ALL` satisfies any declared method on the same path; method
  narrowing (declared POST, served GET on the same path) is not diffed.
- **sds sequence prose is never ghost evidence** — naming an op in a diagram is a claim, and a
  named-but-unserved sds op is not refused.
- **No cross-repo event flows**: an event emitted in repo A and subscribed in repo B is not
  correlated beyond each repo's own records.
- **Integration endpoints are never refused** — an unserved provider endpoint is the provider's
  wire; only the INFO note asks the one question a reader must answer (was it meant as an inbound
  door?).
- **Unmapped URL ports degrade to path matching** rather than failing the claim — a port absent
  from `metadata.json`'s ports projection proves nothing about which app serves the route.

## Fixture test

`tests/work-surfaces.spec.mjs` — 2 tests, passing (`node --test tests/work-surfaces.spec.mjs`):
a synthetic two-repository fixture exercises every refused code (`CONTRACT_GHOST_ROUTE`,
`CONTRACT_GHOST_OP`, `UI_ROUTE_GHOST`, `EVENT_UNEMITTED`), the suspect/info tiers
(`UNDECLARED_ROUTE`, `UNDECLARED_OPERATION`, `UI_ROUTE_UNDECLARED`, `EVENT_UNDECLARED`,
`OPS_ROUTE`), the silence of honest neighbours (served+declared+proved, emitted, claimed), and
the standalone `--tree` CLI (exit 1, grouped output). Convention matched: `node:test`,
`assert/strict`, fixtures under `<drive>/starci-tmp`, `spawnSync` for the CLI test.
