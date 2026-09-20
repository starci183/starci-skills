# Contributing

StarCi is a kernel-agent workflow runtime. Before changing anything, read `SKILL.md`'s load order
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
- **Canonical paths.** New code imports `engine/`, `modules/`, `modules/schemas/`,
  `scripts/checks/spec/` — never the former top-level dirs (`kernel/`, `core/`, `cli/`,
  `contracts/`, `schemas/`, `sqlite/`, …).
- **YAML contracts are data.** `modules/**/*.yaml` files are read by agents and scripts alike;
  keep them declarative — no code, no comments restating the field name.
- **Code style:** plain `.mjs`, node builtins preferred, no comments unless the reason is not
  visible in the code. Line endings are LF (`.gitattributes` enforces it — the install manifest
  hashes bytes).
- **State:** all runtime state lives in `.starciwork/runtime.sqlite` via `engine/ledger-db.mjs`;
  dispatch artifacts use the OS tmpdir or are deleted after delivery.

## Fleet / lane work

Large changes are executed by parallel lanes with a write-allowlist each:

- A lane touches only its allowlisted paths — it never "fixes" a neighbor's file mid-flight.
- A lane finishes by submitting its report through the kernel (`api report`) so the ledger records the
  outcome; no report, the lane is not done.
- Mass deletions and import rewiring are a separate flip step — lanes must not delete doomed
  directories early.

## Commit bar

- `npm test` green (or an explicit note on which spec the cut drops).
- `node --check` on every edited `.mjs`.
- Verify before committing: run the thing you changed, not just the tests that happen to cover it.
- Do not commit `config.yaml`, `settings.local.json`, `.starciwork/`, `node_modules/` or anything
  else `.gitignore` covers.
