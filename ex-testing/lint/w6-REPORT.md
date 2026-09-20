# w6 — docs + coherence + compact checks (was tinkle-20 + tinkle-5 + v11-5)

`tinkle-20.md` does not exist in `ex-testing/briefs/tinkle/` (numbering jumps 19→21);
its mission text survives inside `wave2/w6.md` and was executed from there.
Prior partial work found and reused: v11-5's script edits + `v11-5-runs/` + report
were already on disk (only `v11-FINAL-STATUS.md` was missing); tinkle-5's two
baseline check captures existed but no TINKLE-FINAL.

## Mission 1 — entry docs for the distless canonical layout

Changed files:

| File | Change |
|---|---|
| `SKILL.md` | All 33 `.dist/*` refs repointed to canonical sources (`docs/*.md`, `knowledge/*.yaml`, `workflows/*.yaml|.mjs`, `schemas/*.yaml`, `providers/*.yaml`, `approvals/policy.yaml`, `specifications/*.yaml`, `hosts/orca/launch.mjs`, `scripts/plan.mjs`). New preamble states VERSION `1.0.0-alpha.1`, the distless layout, the `.experiments/` draft status, and the `[Kernel]`/`[Op]` operating model. `model/` → `modules/` (declared data) and `model/registry.json` → `modules/ops/registry.yaml`. `ensure-build` instruction replaced by "no build step; run `scripts/checks/`". |
| `README.md` | Alpha-status paragraph (version, distless, `.experiments`, `[Kernel]`/`[Op]`); quick-start drops `npm run build`; "Knowledge sources versus `.dist`" rewritten as "Canonical sources — no `.dist`"; folder table names `modules/`, `scripts/route/`, `legacy/`; `UPDATE.json`/`README.json` dangling refs → `UPDATE.yaml`/`README.yaml`; contributing block now runs the real checks instead of build steps. |
| `INDEX.yaml` | `build:` block removed; `version: 1.0.0-alpha.1`; folders rewritten to canonical layout (`modules/`, `sqlite/`, `legacy/` added; `ops`/`model` entries retired); all `.json` pointers → `.yaml`; `operators: 21` → `30`. |
| `README.yaml` | `layout: INDEX.json` → `INDEX.yaml`; runtime line says sources are read directly, no `.dist`; alpha status line added; dead build commands dropped (package.json scripts still list them — w5 owns that file). |
| `UPDATE.yaml` | `.dist` refs removed; "Maintaining StarCi 3.0" → "Maintaining this runtime", "5-plus" → "Runtime layout" with the distless rule folded into present tense (per MASTER E5). |
| `MASTER.md` | Status header pointing at wave2 + `.experiments/OPENSOURCE-GOAL.md`; `.dist` refs fixed; the "`.dist` untouched" decision explicitly marked superseded by the distless wave. |
| `goal.md` | Status header naming `.experiments/OPENSOURCE-GOAL.md` the living target; `model/kinds.yaml` → `modules/models/kinds.yaml`, `ops/` → `modules/ops/ops/`. |
| `../AGENTS.md`, `../CLAUDE.md` (repo root) | "follow its build and load order" → "follow its load order — the runtime tree is canonical source, there is no build step". |

## Mission 2 — scripts/checks + compact format

- `scripts/checks/` complete: all 13 `check-*.mjs` + `architecture/` + `code-patterns/` +
  `acceptance/brand/proof/render/stacks/work-*.mjs` present; zero `check-*.mjs` left at
  `scripts/` root; `example-*.mjs` deliberately remain at `scripts/` root (tinkle-4 report).
- v11-5 compact support verified present in code (`INLINE_CRITERION_FIELDS`,
  `resolveRecordRef`, `AC_*` rules, `PROVENBY_AUTHORED`) and by tests:
  `tests/example-work-gate.spec.mjs` **29/29 pass** incl. the five v11-compact cases.
- Full battery re-run on both example trees; **`v11-FINAL-STATUS.md` written** (was the
  missing v11-5 deliverable) — no check went silent; records 311→261 under compaction
  with gate + deep both at 0 refused.

## Mission 3 — coherence sweep

- `modules/ops/registry.yaml` covers all 30 `ops/` dirs exactly; `build-ops-registry.mjs
  --check` → current.
- `modules/models/` covers all 5 `.dist/model/runtimes.json` runtimes; `model/runtimes.yaml`
  ≡ `modules/models/runtimes.yaml`.
- `modules/schemas/index.yaml` covers all 45 `schemas/*.yaml`, none missing/extra.
- All 62 `modules/**/*.yaml` parse via `core/yaml.mjs`.
- Resolvers: `route-op.mjs` 3/3 sane picks, `route-model.mjs` 3/3 (incl. a correct typed
  REFUSAL on elevated risk). Detail in `TINKLE-FINAL.md`.
- Every path referenced in `SKILL.md`, `README.md`, `MASTER.md`, `goal.md` resolves
  (script-checked; the only misses are intentional prose: host `AGENTS.md`/`CLAUDE.md`,
  retired `INDEX.md`, product `workspace.yaml`, legacy `config.example.json`).

## Smoke checks run

```
node scripts/checks/check-example-work.mjs      exit 0 (261 rec / 3138 refs)
node scripts/checks/check-work-deep.mjs          exit 0 (0 refused)
node scripts/checks/check-example-yaml.mjs       exit 0 (857 files)
node scripts/route/build-ops-registry.mjs --check  "current (30 ops)"
node --test tests/example-work-gate.spec.mjs     29/29 pass
modules/**/*.yaml parse sweep                    62 ok / 0 bad
```

## Needed elsewhere (not my dirs)

- `examples/todo-app-backend/.starciwork/_derived/index.yaml` is stale → run
  `example-derive.mjs --work … --write` (example lanes).
- One recorded evidence command still names `../../scripts/check-scoped-lint.mjs`
  (pre-tinkle-4 path) → re-record via `example-evidence.mjs` (example lanes).
- `package.json` still carries `build*` scripts + `.dist` files entry (w5).
- `docs/runtime-distribution.md` still describes a source-built `.dist` install (w5 owns docs/).
- Root junk/dirs: `--help/`, `0`, `m[1]).join('/`, plus session notes `FANOUT-NOTES.md`,
  `PARALLEL-*.md`, `SUITE-FINDINGS.md`, `SUPERVISOR.md`, `notes/` — MASTER E4 wants them
  folded out of the package root; left in place (deletion/recovery is the legacy-triage
  lanes' call).
- `uat` vs `uat.ux` route-key vocabulary split in `modules/ops/` (TINKLE-FINAL G1).

## Assumptions

- Docs describe the target canonical layout even though `ops/`, `model/`, `.dist/` still
  physically exist — w3/w4/w5/w7 perform the actual moves/deletion after this lane.
- `check-work-artifacts/surfaces/consistency/history/replay` exit 1 means "findings",
  not a broken check — all still report (v11-FINAL-STATUS table).
