# UAT evidence capture pipeline

The living walkthrough that produces the `.starciwork` run evidence (`runs/<runId>/{screens,videos}`
plus `manifest.yaml` + `result.md`) for the todo-app feature flows. This page is the operator's
reference: what to start, what to run, what lands where, and how long it is kept.

Harness location: `examples/todo-app-frontend/uat/` (the automation source scope).
Evidence location: `examples/todo-app-backend/.starciwork/features/<feature>/uat/<flow>/runs/`
(the backend owns the one canonical `.starciwork` for this two-repository product).

## Layout

```
uat/
  playwright.config.ts   # workers:1, video+screenshot on, trace on failure, reporter = list + ./lib/run-writer.ts
  global-setup.ts        # computes the one runId (<UTCstampZ>-<short-sha>) before any worker starts
  flows/                 # one spec per registered work/uat-flow record
  lib/
    paths.ts             # resolves FRONTEND_ROOT / BACKEND_ROOT / WORK_ROOT from this file's location
    flow-records.ts      # reads each record's index.yaml + accounts.yaml; refuses to invent a missing one
    run-context.ts       # BASE_URL / DEMO_PASSWORD / LIVE_LOGIN_AUTHORIZED / per-role passwords / commits / runId
    steps.ts             # walkStep() (masked screenshot + timing) + recordAssertion()/recordResource()
    run-writer.ts        # the Playwright Reporter that writes each flow's run folder
```

`FLOW_LOCATIONS` in `lib/flow-records.ts` is the registry: a spec names its own
`{feature, flow}` record and only a registered flow gets the evidence shape. A spec outside it
produces nothing here (deliberate — no orphan evidence).

## Running a capture

### 1. Bring up what the flow actually needs

Every leg that creates a session or a row is gated on infrastructure this harness deliberately does
**not** own (Keycloak + Postgres + the backend API). Two independent things must both hold for a
full walk:

- the frontend serving the pages the specs navigate to, on `UAT_BASE_URL` (default `http://localhost:3000`);
- for signed-in legs: `UAT_LIVE_LOGIN_AUTHORIZED=true` **and** a resolvable credential
  (`UAT_DEMO_PASSWORD`, or per-role `UAT_PASSWORD_<ROLE>`).

The credential is read from the environment at use time only (`run-context.ts#passwordFor`) — never a
literal in source or evidence. In a real stack it is exported by `with-dev-secrets` from the
SOPS-encrypted demo env.

**Full walk (owns the stack):** stand up the dev compose stack, export the demo credential, then:

```bash
cd examples/todo-app-frontend
UAT_LIVE_LOGIN_AUTHORIZED=true UAT_DEMO_PASSWORD='<from sops demo env>' npm run uat
```

**Form-surface walk (frontend only):** start `npm run dev` on `:3000` and run **without** the login
env. The client-side checkpoints (empty/filled form, submit-disabled validation feedback, the
wrong-password submit attempt) still walk for real; every backend-dependent leg is recorded
`observed: not-run` by the spec, not skipped silently and not faked. This is what runs on a lane that
does not own Keycloak/Postgres.

```bash
cd examples/todo-app-frontend
npm run dev &                      # serves /sign-in etc. on :3000
UAT_BASE_URL=http://localhost:3000 npx playwright test -c uat/playwright.config.ts flows/uat.login.sign-in.spec.ts
```

Scope one flow by passing its spec path (above). Omit it to run every registered flow.

### 2. Static gates that must stay green

```bash
cd examples/todo-app-frontend
npm run uat:typecheck     # tsc --noEmit -p uat/tsconfig.json
```

`uat/tsconfig.json` must keep `DOM` in its `lib` — the specs evaluate `window.localStorage` inside
`page.evaluate`, and without the DOM lib `uat:typecheck` fails with `TS2304: Cannot find name
'window'` (the state exup-7 found and fixed).

## What a run writes (naming + format)

`lib/run-writer.ts` runs in the reporter process and, for every non-skipped test whose flow is in
`FLOW_LOCATIONS`, creates `runs/<runId>/` holding **exactly**:

```
manifest.yaml   # schema starci/uat-run-manifest@1: outcome, assertions[], assets[](path/sha256/size),
                # provenance(tool/version/browser/baseURL/frontendCommit/backendCommit),
                # files{} — the six former sidecars folded inline, keyed by filename
result.md       # human summary; the "Outcome: <x>" line is what scripts/check-example-work.mjs concept 12 matches
screens/<step>.png   # one masked full-page screenshot per walkStep, named after the step
videos/<flow>.webm   # the real recording (Playwright video: 'on')
```

The six payloads that used to be separate files (`walk.json`, `ux-checks.json`, `flows.json`,
`run-ledger.json`, `readback.json`, `cleanup.json`) are folded into `manifest.yaml` under `files:`.
That consolidated layout is the v11-4 convention; before exup-7 the writer still emitted them loose,
so a fresh run no longer matched the on-disk history. It does now.

`runId` = `<UTC stamp, e.g. 20260919T183145Z>-<frontend short-sha>`. One id per `npm run uat`
invocation (computed once in `global-setup.ts`), shared by every flow and by the reporter.

### Outcome vocabulary (written by the reporter, not asserted by hand)

| outcome        | when |
|---|---|
| `pass`         | test passed and every recorded assertion was observed as expected |
| `partial-pass` | test passed, but some legs were `not-run` (this is the honest form-surface-walk result) |
| `fail`         | test did not pass, **or** any observed assertion mismatched its expected value |
| `inconclusive` | test passed but recorded no assertions at all |

A `test.skip()` (a blocked record, e.g. `uat.audit.right-to-be-forgotten`) writes **nothing** — a
skipped walk produced no observations to evidence, and fabricating a folder for it is exactly what
this pipeline refuses to do.

## Retention policy (proposed)

- **Append-only, never edited.** `run-writer.ts` never touches a record's `index.yaml` /
  `evidence.yaml` (separate kernel act) and never deletes or rewrites a previous run. Settling a
  record onto a run is a distinct act; capture only appends history.
- **Keep the settled run forever.** Whatever `evidence.yaml` binds (by `inputDigest` + run id) is
  canonical and is never pruned.
- **Keep the newest passing run per record**, so a `done` record always has its pass run on disk.
- **Prune `fail` / `inconclusive` runs older than one release cycle** (they are re-derivable noise,
  not settled proof), and **collapse duplicate `partial-pass` form-surface runs** to the newest per
  frontend commit.
- **Cap history at ~10 runs per flow.** The 2026-09-18 login runs, for example, are near-duplicate
  re-captures of the same walk; the tail past a handful adds bytes without adding signal.
- Media (`screens/*.png`, `videos/*.webm`) dominate size; video is the first thing to prune under a
  byte budget, screenshots are the durable frame-by-frame proof.
- Every asset is content-addressed (`sha256` + `size` in the manifest), so a prune can be verified
  against the manifest rather than trusted by filename.

## Cross-references

- Scratch render harness (impl invite-screen brand evidence, **not** this run format):
  `examples/todo-app-frontend/capture-share.mjs` + `verify-captures.mjs`.
- Prior lane reports: `ex-testing/lint/v9-1-REPORT.md` (audit capability-missing decision),
  `v11-4-REPORT.md` (the sidecar→manifest consolidation whose convention this re-syncs the writer to).
