# c7 — REPORT: tests/ dead-spec sweep + node_modules sanity

Scope: `tests/` (canon dir — swept, not moved). Root `node_modules/` probed, report-only.

## Actions taken

| Path | Verdict | Evidence |
|---|---|---|
| `tests/code-examples.spec.mjs` | **LEGACY → moved** to `legacy/builders/tests/code-examples.spec.mjs` | Sole subject is `legacy/builders/compile-knowledge.mjs` (`compileKnowledge`); asserts nothing about canon. Fixed import `../legacy/builders/compile-knowledge.mjs` → `../compile-knowledge.mjs` and repo-root resolution `'..'` → `'../../..'`, matching the existing `legacy/builders/tests/compile-knowledge.spec.mjs` convention. `node --test` passes (1/1). |
| `tests/runtime-import-closure.spec.mjs` | **LEGACY → moved** to `legacy/builders/tests/runtime-import-closure.spec.mjs` | Sole subject is `legacy/builders/runtime-compile/import-closure.mjs` (`assertRuntimeImportClosure`, a .dist-era build guard). Fixed import → `../runtime-compile/import-closure.mjs`. `node --test` passes (4/4). |

Both files left `tests/*.spec.mjs` (the `package.json` test glob) intentionally — same convention as the pre-existing `legacy/builders/tests/` and `legacy/ops/tests/` specs: legacy subjects keep their coverage beside them.

## Kept in tests/ — verdicts

| Path / group | Verdict | Evidence |
|---|---|---|
| All specs importing canon dirs (`kernel/`, `modules/`, `core/`, `scripts/checks/`, `bin/`, `schemas/`, `sqlite/`, `packages/`, `examples/` gates, `hosts/`) | LIVE | ~140 specs; the bulk of the suite. Untouched. |
| `consolidation`, `workflow-routing`, `source-check-operations`, `specifications`, `kind-graph`, `goal-contract` | LIVE (mixed) | Read `legacy/ops/*` catalog/registry *alongside* canon subjects (`kernel/graph.mjs`, `workflows/*`, `bin/starci-skills.mjs`, `core/yaml.mjs`). Moving would break live-subject coverage; legacy refs all resolve. |
| `code-examples-multifile.spec.mjs` | LIVE (mixed) | Subject is canon `knowledge/code-examples/**` manifests; uses `legacy/builders/compile-knowledge.mjs` only as the validation tool. |
| `verify-proof.spec.mjs` | LIVE (mixed) | Subject is canon `scripts/checks/proof.mjs`; reads `legacy/builders/runtime-modules.txt` (exists). |
| `json-exceptions.spec.mjs` | LIVE (mixed) | Subject is canon `scripts/checks/check-json-exceptions.mjs`; uses legacy fixture `legacy/builders/tests/fixtures/yaml-dist/json-exceptions-offender` (exists). Passes (5/5). |
| `pattern-coverage.spec.mjs` | LIVE | `legacy/builders/compile-knowledge.mjs` appears only in a descriptive coverage-table string. |
| Specs referencing still-at-root uncanon dirs (`../cli/`, `../contracts/`, `../execution/`, `../providers/`, `../models/`, `../docs/`, `../specifications/`, `../workflows/`, `../approvals/`, `../runtime/`) | LIVE (pending other lanes) | Those dirs still exist at root and are owned by sibling lanes; imports resolve today. When those lanes `git mv` their dirs to `legacy/`, the corresponding spec imports become their fix-up burden per `_common.md` §2. |
| `tests/helpers/`, `tests/fixtures/` (incl. `fixtures/quality-source.spec.mjs`, a synthetic forward-test input) | LIVE | Imported/depended on by live specs. |
| `grammar-guards.spec.mjs` `../runtime/helper.js` | LIVE | False positive: the path is fixture content written into a tmp `node_modules/@starci/grammar/` tree, not a repo import. |

## Retired-behavior sweep results

- **`.dist` build pipeline:** every `.dist`/`dist/` match in `tests/` is either (a) a *negative* assertion that remains correct post-distless (`integration.spec.mjs` no-`.dist`-shipped/no-`.dist`-created checks, `npm-package.spec.mjs` files-list check), or (b) fixture content inside synthetic projects (`node_modules/next/dist`, `@starci/grammar/dist`, `src/dist/…` dirs). No spec positively asserts the retired pipeline — nothing to delete.
- **`ops/` at old root path:** no `../ops/` imports remain; `consolidation.spec.mjs:48` asserts `../ops/<id>.vi.md` *does not* exist — already correct. Live specs use `modules/ops/` or `legacy/ops/` explicitly.
- **`model/`/`builders/` at old root path:** no `../model/` or `../builders/` imports remain.
- **yaml-dist migration specs:** already absent; only the `legacy/builders/tests/fixtures/yaml-dist/` fixture data remains, still consumed by `json-exceptions.spec.mjs`.
- **Broken imports:** a full scan of `tests/*.mjs` for relative imports resolving to missing files found no real breakage — all misses are fixture paths generated inside tmp dirs by the specs themselves.

## node_modules sanity (report-only)

`npm ls --depth=0` resolves cleanly against `package.json`: `@jest/globals`, `@nestjs/{common,core,testing}`, `@types/jest`, `ajv`, `esbuild`, `next`, `swr`, `typescript`, `yaml` all present; `node_modules/.package-lock.json` exists; 146 top-level entries. Real install, not stale junk. Two extraneous transitive leftovers (`@emnapi/runtime`, `@img/sharp-wasm32` — sharp/esbuild platform deps); harmless, left alone.

## needed_elsewhere

- None caused by this lane. No file outside the two moved specs references them; `MASTER.md` mentions `runtime-import-closure.spec` by basename only (prose, not a path).
- FYI for the scripts lane: a sibling staged `scripts/yaml-source.mjs → legacy/scripts-loose/yaml-source.mjs` mid-run; nothing under `tests/` (or `bin/`, `kernel/`, `modules/`, `scripts/`, `package.json`, `INDEX.yaml`) references `yaml-source` — no breakage in my scope.

## Guardrails

- No `.dist/`/`.dist.staging/`/`.dist.previous/` created at root.
- `knowledge/` untouched.
- No commits made (the two `git mv` renames are staged only, per `git mv` semantics; content edits are unstaged on top).
