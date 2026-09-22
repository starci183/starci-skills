# Contributing

StarCi is a kernel-agent workflow runtime. Before changing anything, read `CONTEXT.md`'s load order
and the contract YAMLs under `modules/` that touch your surface — contracts are data, and a code
change that contradicts them is a bug in the code.

## Setup

```sh
npm ci
npm test        # node --test tests/*.spec.mjs
```

Node.js 22.13+ is required (`node:sqlite` unflagged). Runtime code has zero npm dependencies —
it runs on node builtins plus the vendored `engine/yaml.mjs` bundle. `devDependencies` exist only
for the test suite and tooling:

- `ajv` — schema assertions inside specs.
- `typescript`, `next`, `swr`, `@nestjs/*`, `@jest/globals`, `@types/jest` — fixture-resolution
  targets: checks resolve a fixture repo's deps, which walk up into this `node_modules`. They are
  not libraries the runtime imports.
- `yaml`, `esbuild` — only needed to rebuild the vendored `engine/yaml.mjs` bundle; the bundle is
  frozen, so most contributors never touch these.

## Test conventions

- Specs are flat: `tests/*.spec.mjs`, `node:test` + `node:assert`. No jest/vitest at root.
- Fixtures are built in tmp dirs (`fs.mkdtempSync` / `tests/fixtures/` builders) — never write into
  the repo under test, never commit generated fixture output.
- No real network. Provider CLIs (`orca`, `devin`, `claude`, `codex`) are stubbed or recorded; a
  spec that would spawn a real agent is wrong.
- Specs may spawn `node scripts/...` under test with `spawnSync` — that is the sanctioned
  process boundary. Assert exit codes and ledger state, not stdout poetry.
- Shared helpers live in `tests/helpers/`; the ledger fixture is `tests/_ledger-fixture.mjs`.

## Evidence policy

Recorded evidence (example `.starciwork` trees, render proofs, coverage artifacts) is **re-run,
never hand-edited**. If a check's expected evidence drifts, regenerate it with the owning script
(`scripts/example/`, `scripts/checks/`) and review the diff — a hand-edited pass is a falsified
record and is worse than a red check.

## Repository conventions

- **One authority per concept.** A rule lives in exactly one file; other surfaces cite it. If you
  find yourself maintaining the same fact twice, one copy is stale — delete it or generate it.
- **Canonical import roots.** Mechanism comes from `engine/`, contract data from `modules/`
  (schemas from `modules/schemas/`), spec validators from `scripts/checks/spec/`, executables from
  `scripts/`. An import that resolves outside those four roots is the bug.
- **YAML contracts are data.** `modules/**/*.yaml` files are read by agents and scripts alike;
  keep them declarative — no code, no comments restating the field name.
- **Code style:** plain `.mjs`, node builtins preferred, no comments unless the reason is not
  visible in the code. Line endings are LF (`.gitattributes` enforces it — the install manifest
  hashes bytes).
- **State:** all runtime state lives in `.starciwork/runtime.sqlite` via `engine/ledger-db.mjs`;
  dispatch artifacts use the OS tmpdir or are deleted after delivery.

## Parallel lanes

A large change is cut into lanes that run at the same time, each in its own worktree on its own
branch, each with a write-allowlist naming the paths it may touch:

- A lane writes only inside its allowlist. A defect it finds elsewhere goes into its report for the
  owning lane, not into a drive-by edit.
- A lane that depends on another's surface starts after that one merges, and merges `main` before
  it reads anything.
- A lane finishes by submitting its report through the kernel (`api report`) so the ledger records
  the outcome; no report, the lane is not done.
- Deletions and import rewiring that cross allowlists are their own cut, merged between lanes.

## Commit bar

- `npm test` green (or an explicit note on which spec the cut drops).
- `node --check` on every edited `.mjs`.
- Verify before committing: run the thing you changed, not just the tests that happen to cover it.
- Do not commit `config.yaml`, `settings.local.json`, `.starciwork/`, `node_modules/` or anything
  else `.gitignore` covers.

## Editing contracts and prose

Every canonical file — `CONTEXT.md`, `README.md`, `docs/**`, `modules/**`, `skills/**` — says
one thing, once, in the present tense. These six rules are the bar for any edit on the alpha
line; a review that finds a violation sends the change back.

1. **Present tense, no ghosts.** Describe the tree as it is. Never define something by negating
   a state the tree no longer has (`distless`, "former top-level dirs", "no `.dist`", `legacy`,
   `compat`). History goes to `CHANGELOG.md` or `.experiments/practices/`, never into the
   sentence that defines the present.
2. **Replace, never append.** A feedback edit rewrites the sentence that holds the rule. Do not
   add a second sentence under the first, and do not leave the old condition clause standing
   when the new rule carries its own. One concept has one paragraph and that paragraph is the
   latest version. A summary block (`business:` in an op, a README list) is regenerated in the
   same commit or deleted.
3. **One place to do, one place to check.** Inside an op manifest a rule appears in exactly one
   `steps[].action` and in at most one `proofs[]` entry. `reads` and `writes` describe data, not
   rules. Numbers — rounds, candidates, timeouts, retry limits, cadences — are data in one yaml
   that code reads; they are never prose repeated in several files.
4. **Claims must execute.** `citation:`, `enforcedBy:`, `source:`, "validated by", "refuses",
   "verified before effects" name a file and a behaviour that exist. If the code does not do it,
   the yaml says so or the claim is removed. On the alpha line the default is to make the yaml
   tell the truth; add code only where a test shows a real hole.
5. **Host calls go through `scripts/api/orca/`.** No agent-facing prose tells an agent to run
   `orca` or to read `modules/host/**`; agents call `scripts/kernel/api.mjs` or a wrapper.
6. **Every cut lands with evidence.** `node --check` on touched `.mjs`, the specs that cover the
   touched surface, and — when a rule moved — the check that would catch it moving back.
