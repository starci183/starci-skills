# f3 cleanup report — docs/ specifications/ fixtures/ worktrees/ skills/ models/ mcp/

Date: 2026-09-20. Scope: the six dirs assigned to lane f3. Verdict rule: LIVE only if
referenced by live code (`scripts/`, `kernel/`, `core/`, `bin/`, `modules/`, `providers/`,
`tests/`, `SKILL.md`, `package.json`, `INDEX.yaml`, `README*`), else `legacy/`.

**Result: no moves. Every assigned dir is proven LIVE. Zero refs required updating.**

## Per-dir verdicts

### docs/ — LIVE (78 files, kept whole)
- `package.json:39` ships `"docs/"` in the npm `files` payload.
- `INDEX.yaml` `folders.docs`: "Documentation, one file per concept" — declared canonical.
- Live references: `kernel/kernel.mjs:265,1622` (docs/supervision-templates/op.md,
  docs/ledger-db.md), `core/index.mjs:18,152,161`, `bin/starci-skills.mjs:97,158`,
  `scripts/checks/check-example-work.mjs:419,439`, `scripts/example-evidence.mjs:11`,
  `modules/models/code-patterns.yaml` (28 `guidance: docs/…` entries),
  `modules/goal/{anatomy,archetypes,existing,legality}.yaml` (dozens of `docs/…` pointers),
  `README.md` (28 refs incl. `docs/5-plus.md` at :178,:223), `SKILL.md` (25 refs incl.
  `docs/design-pattern-source-review-20260916.md` at :21), `tests/*` (40+ spec files).
- Advisory (not moved): 12 top-level docs have no inbound `docs/<name>` link from live
  code or other docs — `brand-checks.md`, `kernel-guards.md`, `nest-syntax-checks.md`,
  `nest-test-discovery-check.md`, `next-data-lifecycle-check.md`,
  `ops-source-ownership.md`, `orca-execution.md`, `provider-observe.md`,
  `runtime-allocation.md`, `v5-plan.md`, `verify-proof.md`, `workflow-store.md`; plus
  5 under `docs/examples/` (`grit/ecommerce-fe.md`, `handoff/op-*.md` ×3,
  `v4-live-proof/README.md`). They document live features (e.g. `scripts/checks/brand.mjs`
  implements `starci/brand-checks@1`); docs are leaf artifacts, kept per UNSURE→LIVE.
  `v5-plan.md` is linked by `docs/orca-execution.md:16`; `5-plus.md` by README;
  `design-pattern-source-review-20260916.md` by SKILL.md — all LIVE despite MASTER.md:24
  calling them "dated plans". The other dated plans MASTER.md names (`v4-plan`,
  `v4.1-supervision-plan`, `handover-2026-09-14`) already sit in `legacy/docs/`.

### specifications/ — LIVE (11/11 files reachable)
- `core/index.mjs:2-6` imports `validate.mjs`, `sds.mjs`, `sds-map.mjs`,
  `srs-sections.mjs`, `srs-v3.mjs` directly.
- `validate.mjs:4` imports `./v2.mjs`; `validate.mjs:9` reads `./contract.yaml`.
- Data files referenced from live surfaces: `sds.schema.yaml`, `sds-map.yaml`,
  `srs-sections.yaml`, `srs-v3.schema.yaml` (`tests/pattern-coverage.spec.mjs:144-146`,
  `tests/specification-vnext.spec.mjs:40`, `SKILL.md:128,130`).
- `tests/specifications.spec.mjs`, `tests/sds.spec.mjs`, `tests/sds-map.spec.mjs`,
  `tests/srs-sections.spec.mjs`, `tests/srs-v2.spec.mjs`,
  `tests/decision-inputs.spec.mjs`, `tests/source-provenance.spec.mjs` all import it.
- `tests/backend-handoff.spec.mjs:199` and `tests/source-layout.spec.mjs:38` copy
  `specifications/` into runtime layouts; `INDEX.yaml` declares `folders.specifications`;
  `package.json` ships `"specifications/"`.

### fixtures/ — LIVE (9/9 files reachable)
- Imported by specs: `build-workspace.mjs` (`tests/acceptance.spec.mjs:7`,
  `tests/cli.spec.mjs:11`), `sds.mjs` (`tests/authored-work-binding.spec.mjs:8`),
  `srs-v3.mjs` + `srs-v3-workspace.mjs` (`tests/specification-vnext.spec.mjs:5,9`).
- `forward-goal/draft/**` copied by `tests/cli.spec.mjs:288`;
  `forward-goal-report.yaml` referenced by `docs/config-format.md:73`.
- `package.json` ships `"fixtures/"`.
- Advisory: `fixtures/` is not declared in `INDEX.yaml` `folders:` (test-support data
  could arguably live under `tests/fixtures/`), but it is proven live as-is; a move would
  be a refactor touching many specs — left for parent decision.

### worktrees/ — LIVE (active git worktrees; never moved)
- Holds **6 registered worktrees of the PARENT repo**
  (`D:/Repositories/starci-academy-backend`): `agent-a75cd99400d6ba88a`,
  `dazzling-tereshkova-dafe3b`, `dreamy-margulis-c127b7`, `exciting-chebyshev-292790`,
  `goofy-chatterjee-f38403`, `laughing-williamson-09b564` — each `.git` file points at
  `D:/Repositories/starci-academy-backend/.git/worktrees/<name>` and each appears in the
  parent's `git worktree list` on live branches (`worktree-agent-*`, `claude/*`).
  Moving would break the parent's registrations. Per rule 6: LIVE.
- Plus `worktrees/_briefs/` (agent briefs, runtime data).
- Gitignored (`.gitignore:13` "Actual local Git checkouts are not product completion
  storage"), untracked (0 files in `git ls-files`), not in `package.json` files.
- Live code honors it: `bin/starci-skills.mjs:345,363` preserves `worktrees` path
  segments during upgrades; `scripts/checks/check-json-exceptions.mjs:27` skips it.

### skills/ — LIVE (4 companion skills)
- `tests/skills-tree.spec.mjs` is an active contract: reads `skills/*/SKILL.md`,
  asserts `package.json.files` includes `"skills/"` (:21) and `INDEX.yaml.folders.skills`
  is a string (:22).
- `SKILL.md:60` routes chats to `skills/workflow-chat/SKILL.md`; the spec asserts the
  link exists (:61).
- `package.json:16` ships `"skills/"`; `bin/starci-skills.mjs:116-131,344` handles
  `skills/starci-lite/` retire/preserve compatibility.
- Contents: `computer-use`, `orca-cli`, `orchestration`, `workflow-chat` — all pass the
  spec's frontmatter contract (name == dir name).

### models/ — LIVE (the "stray" is declared canonical here)
- 8 kernel files import it directly: `kernel/{kernel,goal,verify,amendment}.mjs` →
  `../models/functions.mjs`; `kernel/engine.mjs` → `../models/validator-transport.mjs`;
  `kernel/manager.mjs` → `../models/manager-contract.mjs` (also re-exported);
  `kernel/job-model-worker.mjs` → `../models/functions.mjs`.
- ~10 specs import it (`tests/llm-functions.spec.mjs:8` imports 30+ symbols;
  `engine-adapter`, `execution-contracts`, `goal-contract`, `goal-grounds-intake-scope`,
  `headless-model-registry`, `luna-allocation`, `manager-contract`, `verify-required`,
  `workflow-kernel`, `workflow-restart`).
- `INDEX.yaml` `folders.models`: "The model functions the runtime calls with a typed
  form" — the repo's own layout schema declares root `models/` canonical.
- `package.json` ships `"models/"`; `tests/source-layout.spec.mjs:38` and
  `tests/workflow-kernel-shared-ledger.spec.mjs:32` include `models` in runtime copies.
- Not a duplicate: `models/{functions,manager-contract,validator-transport}.mjs` are the
  only copies; `modules/models/` holds the YAML catalog (kinds/registry/selection/hosts)
  plus `index.mjs` — different content, both declared.
- Advisory for parent: the canonical-layout brief calls `models/` stray vs
  `modules/models/`. Consolidating `models/*.mjs` into `modules/models/` is a refactor
  (rewire ~18 import sites); per rules it is proven live and stays.

### mcp/ — N/A
- Directory does not exist. `.gitignore:9` already ignores `/mcp/` ("local tools and
  scratch are not distributable skill sources"). Nothing to triage.

## Pre-existing stale reference found (not mine to fix — schemas/ is never-touch)
- `schemas/workflow-report.schema.yaml:19` — `observations:` field text points at
  `docs/orca-runtime-upgrades.md`, but that file was moved to
  `legacy/docs/orca-runtime-upgrades.md` in commit `db30045c`. The schema is still live
  (`kernel/reports.mjs:10` `starci/workflow-report@1`, `workflows/supervision.yaml:160`).
  Parent may want to repoint the description to `legacy/docs/orca-runtime-upgrades.md`
  or confirm the reference is intentionally historical.

## Files moved / refs updated
None. All dirs proven live; no legacy moves performed, so no reference updates needed.

## Commands run (evidence)
- `git worktree list` (this repo + parent) — confirmed `.claude/worktrees/*` are live
  parent-repo worktrees.
- `git check-ignore` / `git ls-files` — `worktrees/` ignored+untracked; the other five
  dirs fully tracked.
- grep sweeps of `docs/`, `specifications/`, `fixtures/`, `skills/`, `models/` path and
  basename references across `kernel/ core/ bin/ scripts/ modules/ providers/ tests/
  schemas/ hosts/ workflows/ cli/ contracts/ init/ sqlite/ knowledge/ examples/` plus all
  root files (`SKILL.md`, `INDEX.yaml`, `package.json`, `README*`, `MASTER.md`,
  `UPDATE.yaml`, `goal.md`, `SUPERVISOR.md`).
