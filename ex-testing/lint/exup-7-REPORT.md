# Lane exup-7 — REPORT: UAT evidence pipeline hardening

Date: 2026-09-19 (UTC). Scope (per `ex-testing/briefs/exup/exup-7.md`, after `_common.md` +
`SKILL.md` + `OPENSOURCE-GOAL.md`): `todo-app-frontend` UAT/e2e tooling + read-mostly audit of
`todo-app-backend/.starciwork/features/*/uat/**`. Only new runs created; no prior run edited, no
record `index.yaml`/`evidence.yaml` touched.

Verdict: **partial** — the pipeline was broken in two ways I own and fixed, and its aliveness is now
proven with a fresh, canonical-format run; the remaining evidence gaps are either a documented
capability block or belong to the live-stack lane, not to this harness. Details and open items below.

## 1. Coverage matrix (measured, not asserted)

`state` from each record's `index.yaml`; runs/outcome/fmt from each flow's `runs/` folder;
`fmt` = whether the newest run already holds the consolidated `{manifest.yaml,result.md,screens,videos}`
layout (it does for all — see §3 for why the *writer*, not the history, was the problem).

| feature/flow | record state | evidence.yaml | runs | newest run outcome | fmt | video |
|---|---|---|---|---|---|---|
| audit/right-to-be-forgotten | todo | **NO** | **0** | — (spec `test.skip`) | — | — |
| login/sign-in | done | yes | 8 (7 pre-existing + 1 new) | partial-pass (new); settled on 20260919T112508Z **pass** | consolidated | 1 |
| notify/digest-and-unsubscribe | inprogress | yes | 8 | partial-pass | consolidated | 1 |
| plan/upgrade-after-cap | inprogress | yes | **1** | **fail** | consolidated | 1 |
| recur/make-recurring | **todo** | **NO** | 3 | **fail** | consolidated | 1 |
| share/invite-and-collaborate | inprogress | yes | 2 | partial-pass | consolidated | 1 |
| task/create | done | yes | 4 | pass | consolidated | 1 |

## 2. Features with records but no UAT run evidence (mission step 1)

- **audit/right-to-be-forgotten** — the only flow with `.starciwork` records and **zero runs**.
  This is a *deliberate* block, not a broken capture: the spec
  `uat/flows/uat.audit.right-to-be-forgotten.spec.ts` is `test.skip(true, skipReason(record))`
  because its own record `blockedBy` (and lane **v9-1**) establish `APP_CAPABILITY_MISSING`: step 4
  ("as the seeded operator, read the log … unnamed") has no operator-facing audit-log UI and an empty
  `AUDIT_OPERATOR_SUBJECTS` roster in this deployment. `run-writer.ts` returns early on `skipped`, so
  no folder is fabricated. Correctly left as-is; filling it needs the product surface, not a capture run.
- **recur/make-recurring** — has 3 runs but `state: todo`, **no `evidence.yaml`**, and its newest run
  outcome is **fail**. Evidence exists as raw runs but is not settled; this is a records-authoring /
  live-retry gap (the run failed mid-walk), not something the capture harness may paper over.

## 3. Pipeline defects found + fixed (the actual hardening)

### 3a. `npm run uat:typecheck` was broken — missing DOM lib

`uat/tsconfig.json` declared `"lib": ["ES2022"]` with no `"DOM"`, but the plan and share specs
evaluate `window.localStorage` inside `page.evaluate`:

```
uat/flows/uat.plan.upgrade-after-cap.spec.ts(173,49): error TS2304: Cannot find name 'window'.
uat/flows/uat.share.invite-and-collaborate.spec.ts(146,47): error TS2304: Cannot find name 'window'.
```

(The raw `tsc` exit is `EXIT_NONZERO`; a `| tail` pipeline masks it to 0 — measured with a marker
file, not the pipe's exit.) Fix: `uat/tsconfig.json` → `"lib": ["ES2022", "DOM"]` (the idiomatic
Playwright-spec fix; no `as any`). Re-ran `npx tsc --noEmit -p uat/tsconfig.json` → `EXIT_ZERO`,
0 bytes of output. This is the type-level gate for the UAT harness and it now passes.

### 3b. `run-writer.ts` emitted the wrong shape — drifted from the v11-4 consolidation

Lane **v11-4** consolidated every run folder to exactly `{manifest.yaml, result.md, screens/, videos/}`
by folding the six JSON sidecars into `manifest.yaml` under a `files:` key and deleting the loose
files — and explicitly flagged *"both uat run-writer.ts still emit sidecars"* as an unfixed follow-up.
So the *writer* and the *on-disk history* disagreed: any fresh capture reintroduced six loose sidecar
files that the repo convention had just removed. Confirmed empirically: my first capture (with the
un-fixed writer) produced a folder with `walk.json ux-checks.json flows.json run-ledger.json
readback.json cleanup.json` as separate files. (That non-conforming stray run — mine, this session —
was deleted; no pre-existing run was touched.)

Fix: `uat/lib/run-writer.ts` now builds the six payloads as objects and attaches them to the manifest
under `files:` (alphabetical keys `cleanup.json, flows.json, readback.json, run-ledger.json,
ux-checks.json, walk.json`, matching the consolidated manifests byte-for-byte in shape), and writes
only `manifest.yaml`. Verified: the re-captured run's top-level keys and `files:` keys both compare
`=== true` against the canonical `login/.../runs/20260919T112508Z-5c10a673/manifest.yaml`.
Re-ran `npx eslint uat/lib/run-writer.ts` → 0 errors. (Note: `uat/` is not in the eslint config's
scope at all — "File ignored because no matching configuration was supplied"; `uat:typecheck` is the
real gate. Flagged as needed-elsewhere, §5.)

## 4. Ran the capture pipeline for real (mission step 2) — fresh, canonical evidence

Stack state on this host: `:3000`/`:3001`/`:5432` **closed** (the todo dev compose was not up; only an
unrelated `:8080` gateway answered). This lane does **not** own Keycloak/Postgres/backend and must not
start or write another lane's stack, so the honest mode is the frontend-only **form-surface walk**.

Brought up the frontend I *do* own (`npm run dev`, verified `GET /sign-in → 200`, final `/en/sign-in`)
and ran `login/sign-in` through the fixed pipeline **without** `UAT_LIVE_LOGIN_AUTHORIZED`:

- New run: `login/uat/sign-in/runs/20260919T183145Z-5c10a673/` — `1 passed`, outcome `partial-pass`.
- Folder holds exactly `{manifest.yaml, result.md, screens/, videos/}`; `screens/` = empty.png,
  filled.png, working-and-refused.png, screenshot.png; `videos/sign-in.webm` present (5 assets, each
  with sha256+size in the manifest).
- Client-side legs observed for real: `ux.sign-in.validation-feedback` = `yes` (submit disabled while a
  field is empty). Backend legs recorded `not-run` with reasons (`fr.login.sign-in`,
  `br.login.session.restores`, `ux.sign-in.error-feedback`, `br.login.password.sign-in`) — **not**
  skipped silently, **not** faked. `readback.json` lists all four under `notRun`.
- Append-only: the 7 pre-existing login runs are untouched; login's `state: done` remains settled on
  its `pass` run 20260919T112508Z — this lane never edits `evidence.yaml`.

## 5. Negative-path evidence (mission step 3)

The four requested error classes:

- **form validation fail** — freshly captured in the new run (`empty` → disabled submit, observed yes).
- **unauthorized** — present in prior live-stack runs (task `stranger-delete-refused.png`, share
  `editor-sign-in-finds-no-accept-surface.png`); not re-capturable here (needs a real second signed-in
  identity → the stack this lane doesn't own). A *new* unauthorized flow would require authoring a
  `uat-flow` record — a kernel act outside a capture brief — so none was invented.
- **cap-exceeded** — present in the plan run (`twenty-first-create-refused.png`,
  `upgrade-action-refused-at-gateway.png`), **but that run's outcome is `fail`** (§2) and its
  re-capture needs cap seeding + psql on the owned stack.
- **offline / API-unreachable** — the new run exercises it honestly: `working-and-refused` got no
  `/graphql` answer and recorded `not-run` ("the API origin did not answer") rather than a fake refusal.

## Gaps remaining (open items for the wave / next legs)

1. **audit/right-to-be-forgotten** stays 0-run: blocked on `ui.audit` operator surface + a populated
   `AUDIT_OPERATOR_SUBJECTS` roster (v9-1). Owner: product/backend, not capture.
2. **plan/upgrade-after-cap** has exactly one run and it is `fail`; needs a full-stack retry
   (`UAT_LIVE_LOGIN_AUTHORIZED=true` + `UAT_DEMO_PASSWORD` + cap seeding). Owner: live-stack lane.
3. **recur/make-recurring** has runs but is `todo`/`fail`/no `evidence.yaml`; needs a passing
   full-stack walk + record settle. Owner: live-stack lane + kernel.
4. notify/share newest runs are `partial-pass`; a green `pass` for each needs the live stack.
5. `uat/` is not covered by the frontend eslint config (`run-writer.ts`: "File ignored").
   Wiring the UAT harness into lint is a tooling follow-up.
6. The sibling `ecommerce-app-fe` may carry a second `run-writer.ts` with the same sidecar drift
   (v11-4 said "both"). Out of exup-7's ownership; **needed elsewhere.**

## Artifacts this lane produced

- `examples/todo-app-frontend/uat/tsconfig.json` (DOM lib) — fixed.
- `examples/todo-app-frontend/uat/lib/run-writer.ts` (manifest fold) — fixed.
- `examples/todo-app-backend/.starciwork/features/login/uat/sign-in/runs/20260919T183145Z-5c10a673/` — new run.
- `ex-testing/uat/README.md` — capture how-to, naming, retention policy (mission step 4).
