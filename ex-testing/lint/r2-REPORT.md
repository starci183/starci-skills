# r2 — evidence re-record + legality vocabulary reconcile

Lane: `r2` (reconcile). Scope: (A) re-derive the 48 `CODE_DIGEST_STALE` evidence
records under `examples/todo-app-backend/.starciwork/` by actually re-running
`scripts/example-evidence.mjs`; (B) reconcile `modules/goal/legality.yaml`
`producesVocabulary` against the real `modules/ops/ops/*.yaml` catalog so
w7/tinkle-13 check 4 passes.

Constraints honored: `knowledge/` untouched (0 modified files), nothing
committed, no `.dist/` created.

## A) Evidence re-record — check-example-work green

Baseline: `node scripts/checks/check-example-work.mjs` exited 1 with exactly
**48 `CODE_DIGEST_STALE` refusals**, all under
`examples/todo-app-backend/.starciwork/features/{audit,notify,plan,recur,share,task}/`
(br/sds/fr/contract/event/impl evidence.yaml files). They staled because lanes
w8/w9 changed real source (upload, observability, seeds), moving the owned-dir
digests.

Method (per policy — evidence re-derived by re-running, never hand-edited):

1. Extracted each stale evidence.yaml's recorded assertions (`id` + `command`)
   into `ex-testing/lint/scratch/r2/.r2-stale-evidence.json` using
   `core/yaml.mjs`'s parser.
2. Re-ran `node scripts/example-evidence.mjs --work
   examples/todo-app-backend/.starciwork --record <id> --cwd
   examples/todo-app-backend --assert <id>=<command> ...` for all 48 records
   (driver: `ex-testing/lint/scratch/r2/r2-rerecord.mjs`; full per-assertion
   log: `ex-testing/lint/scratch/r2/.r2-rerecord-log.json`).
3. **47/48 re-recorded clean, outcome pass** on the first pass — including the
   live proofs (`scripts/live-proof.sh`, `live-proof-share.sh`,
   `live-proof-notify.sh` against the dev API on `localhost:3001`, and
   `npx tsc --noEmit` typechecks).
4. `impl.recur.todo-app-backend.engine`'s `live-e2e` assertion
   (`node .starciwork/features/recur/impl/todo-app-backend/engine/assets/live-proof.mjs`)
   failed on the first pass with `fetch failed` — the script targets its own
   lane API instance at `http://localhost:3105` (default `API_URL`), which was
   not running. The recorded command was correct; the *environment* was
   missing. Per the script's own header I started the prescribed instance:
   `DATABASE_URL=postgres://postgres:postgres@localhost:5432/todo_recur
   PORT=3105 RECUR_TICK_CRON='*/5 * * * * *' node dist/main.js` (the
   `todo_recur` database already exists in `compose-postgres-1`), then re-ran
   the evidence script for that record — both assertions (`unit`,
   `live-e2e`) now exit 0, outcome pass.

**Recorded-command fixes needed: none.** No assertion path 404'd; no
`scripts/` → `scripts/checks/` move affected any recorded command (all
commands run inside `examples/todo-app-backend`, whose own `scripts/` dir is
unchanged). Every re-run used the assertion commands exactly as previously
recorded.

Verification: `node scripts/checks/check-example-work.mjs` now exits 0 —
"277 record(s), 3240 ref(s), 140 evidence file(s), 44 artifact payload(s)
skipped: every id matches its place, every ref resolves, and every
new-concept rule is satisfied". Zero refusals.

Note for other lanes/operator: the recur-lane API instance on :3105 was left
running (background shell) in case sibling reconcile lanes need to re-derive
recur evidence too.

## B) Legality vocabulary reconcile — check 4 clean

w7's check 4 (`ex-testing/lint/scratch/w7/check4c.mjs`, refined form of
`check4-vars.mjs`) reported two drifts:

1. `opProduces` key `implementation.plan` has no `modules/ops/ops/*.yaml` —
   vocabulary without an operator.
2. Five `opProduces` vars had no `stateVariables` family match:
   `request: analyzed`, `node.X: cut into disjoint children`,
   `knowledge: repaired`, `workspace: managed`, `task: executed`.

Findings that decided the direction:

- `implementation.plan` is a **kind**, not an op: `modules/models/kinds.yaml`
  (`implementation.plan:` entry, `operator: work.author`, "it carries the
  `work.author` operator contract under its `work.cut` sequence, so no second
  operator exists") and `legacy/ops/tests/ops.spec.mjs` actively asserts
  `catalogue.ops.some(op=>op.id==='implementation.plan') === false` — "the cut
  is a kind, never a second operator". So the contract does **not** support
  adding `modules/ops/ops/implementation.plan.yaml`; the fix is in the
  vocabulary.
- `work.author`'s own contract carries cut mode (writes `parts` at
  `.starciwork/<node-dir>/<part>/index.yaml`; `business.produces` lists
  "cut-mode children + the derived parent"), so `node.X: cut into disjoint
  children` is genuinely produced by `work.author`.
- `route:` blocks carry `prerequisites` but no `produces:` — the documented
  KNOWN GAP in legality.yaml's own header; `opProduces` *is* the machine
  table for it, so the route-side `PRODUCES-DIFF` informational lines in
  `check4-vars.mjs` are expected, not drift.

Changes to `modules/goal/legality.yaml` (vocabulary derives from ops):

- `producesVocabulary.opProduces`: removed the `implementation.plan:` key;
  folded `"node.X: cut into disjoint children"` into `work.author`'s list.
  opProduces now has exactly the 30 catalog ops.
- `producesVocabulary.stateVariables`: added the five missing variables
  (`request: analyzed`, `node.X: cut into disjoint children`,
  `knowledge: repaired`, `workspace: managed`, `task: executed`) — each is
  produced by a real op (`request.analyze`, `work.author` cut mode,
  `knowledge.repair`, `workspace.manage`, `task.execute`).
- Added a comment on `opProduces` recording that it is keyed by operator and
  that `implementation.plan` is a kind carried by `work.author`.

Verification:

- `node ex-testing/lint/scratch/w7/check4c.mjs` → clean: `opProduces keys not
  in ops catalog: []`, `ops missing from opProduces: []`, zero vars without a
  `stateVariables` family match, zero unproduced `stateVariables`.
- `node scripts/route/route-plan.mjs --target "ui.X: verified"` → still emits
  the same 10-leg chain, exit 0 (route-plan consumes `opProduces` as its CHAIN
  lookup; `implementation.plan` was never a chain leg — `work.author` is
  injected instead).
- `node ex-testing/lint/scratch/w7/modules-parse.mjs` → "62 yaml file(s)
  under modules/: all parse".

## Files changed by this lane

- `modules/goal/legality.yaml` — producesVocabulary reconcile (above).
- 48 `examples/todo-app-backend/.starciwork/features/**/evidence.yaml` —
  re-derived by `scripts/example-evidence.mjs` (fresh codeDigest/recordDigest,
  fresh capturedAt, same recorded commands, all outcome pass).
- `ex-testing/lint/scratch/r2/` — lane scratch (driver + extracted assertions
  + full re-run log).
- `ex-testing/lint/r2-REPORT.md`, `ex-testing/lint/done/r2.done` — this report
  and the done marker.
