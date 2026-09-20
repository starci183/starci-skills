# k5 — define-goal: --project resolution + upgraded --plan

Lane k5. Owned files: `scripts/goal/define-goal.mjs`, `modules/goal/define-goal.yaml`.
No commits made.

## Changes

### `scripts/goal/define-goal.mjs` (rewritten, persist transaction untouched)

- **`--project <name>`**: reads `<source>/.workspaces/projects/<name>/work.json`
  (`starci/workspace-binding@1`), where `source` = the repo containing `.claude`
  (`path.dirname(skillRoot)`). Every `repositories.<role>.pathFromSource` resolves
  against source; `work.ownerRole` picks the ledger owner. `repo` is then the
  resolved owner repo, so `ledgerFileFor(repo)` yields
  `<owner-repo>/.starciwork/runtime.sqlite` — project-owned, not the host repo.
  All declared repos become the cold-scan set (`scanRepos`).
- **`--repo <path>`** unchanged: single repo, ledger under it, still defaults to
  cwd. `--project` + `--repo` together → exit 2 (mutually exclusive).
- **`--plan` table**: STATE (per-repo signals via `scripts/goal/assess.mjs`
  `--repo <p> [--repo <p2>] --json`; missing script / non-zero exit / bad JSON →
  `assess unavailable`, never blocks), GOAL, OP CHAIN (route-plan legs, each
  mapped to a cold tier — easy=15m / medium=45m / hard=90m, printed with
  `estimate is cold`), WILL-WRITE, ledger path. Writes nothing; exits 0.
- **`--json` plan payload**: `{plan, title, prompt, goalIdentity, project?,
  opChain, legs, estimate, assess, assessNote?, willWrite, ledger}` — `assess`
  is the parsed assess output or `null` when unavailable.
- Tier map (`COLD_TIER`): ask/analyze/scope/decision/goal.revise/workspace.manage
  → easy; `*.implement` / `code.refactor` / `integration|e2e|uat.verify` /
  `release.deliver` / `runtime.operate` → hard; everything else → medium.
- assess lookup is shape-tolerant (`repos[]`/`repositories[]` lists keyed by
  repo|path|root|name, or path-keyed objects) since lane k4's output shape was
  still open when this was written.

### `modules/goal/define-goal.yaml`

- `input.repo` scoped to single-repo mode; `input.project` documents the
  work.json resolution (ownerRole → project ledger); `input.plan` documents the
  plan table and the plan → ok → persist flow.
- `derives.assess` added; two rules added: mutual exclusivity and
  "plan → owner ok → persist" (`--plan` never opens the ledger transaction).

## Verification

`node --check` clean. YAML parses (`goal.define`, input keys
`prompt,repo,project,title,plan`). Mutual exclusion, unknown project and missing
`--text` all exit 2 with a message.

### Smoke test (required command, real output)

`node .claude/scripts/goal/define-goal.mjs --project nivo --text "test" --title t --plan`
from `D:\Repositories\starci-academy-backend`:

```
PLAN — goal "t"
  identity: 9f86d081884c7d65
  scope: project 'nivo' — owner role 'be' → D:\Repositories\nivo-backend
STATE (cold scan):
  be  D:\Repositories\nivo-backend  — assess unavailable
  fe  D:\Repositories\nivo-fe  — assess unavailable
GOAL:
  test
OP CHAIN (estimate is cold: easy=15m medium=45m hard=90m):
  1. provision.ask  ~15m easy
  total ~15m — estimate is cold
WILL WRITE:
  - workflows row (phase=queued)
  - goals row (revision 0)
  - inbox row (kind=goal, status=pending)
  - goal-defined event
ledger: D:\Repositories\nivo-backend\.starciwork\runtime.sqlite
re-run without --plan to persist
```

Note: `assess.mjs` does not exist yet (lane k4), so the degrade path is what
was exercised. `work.json` declares `work.pathFromRepository: ".work"`; per the
lane spec the ledger is `<owner>/.starciwork/runtime.sqlite` — flag if the
binding's `pathFromRepository` should win instead.

### --repo regression (plan only, no writes)

`--repo .` prints the same table with `scope: repo D:\...\starci-academy-backend`
and `ledger: D:\...\starci-academy-backend\.starciwork\runtime.sqlite` — single
repo scanned. A fuller prompt (`"build the enrolment screen"`) derives a real
10-leg chain (`request.analyze → scope.define → business.decide →
architecture.decide → brand.decide → interface.draw → work.author →
interface.implement → uat.verify → review.verify`, total ~480m cold).
