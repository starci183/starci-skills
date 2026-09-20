# c6 lane report — triage: `scripts/` root (loose `*.mjs`, excluding canon `checks/` + `route/`)

## Verdicts

| Path | Verdict | Evidence |
| --- | --- | --- |
| `scripts/config.mjs` | live | imported by `kernel/kernel.mjs:49`, `kernel/chains.mjs:11`, `bin/starci-skills.mjs:14`, `cli/main.mjs:2`, `tests/config.spec.mjs:6` |
| `scripts/example-ownership.mjs` | live | imported by canon `scripts/checks/{check-work-surfaces,check-work-replay,check-work-history}.mjs`, `scripts/route/{route-plan,dispatch-op}.mjs`, `tests/{work-consistency,example-derive}.spec.mjs`, and all sibling `example-*.mjs` |
| `scripts/example-derive.mjs` | live | `tests/example-derive.spec.mjs` imports `computeDerived`/`buildYamlDocument`/`runDerive`; imported by `example-critique.mjs`; generates canon `examples/*/.starciwork/_derived/` |
| `scripts/example-critique.mjs` | live | `tests/example-critique.spec.mjs` imports `computeCritique`/`runCritique`; generates `_derived/critique.{yaml,md}` |
| `scripts/example-evidence.mjs` | live | evidence recorder; `tool: scripts/example-evidence.mjs` marker in dozens of canon `examples/**/evidence.yaml`; paired with `example-verify.mjs` |
| `scripts/example-render-proof.mjs` | live | `command: node scripts/example-render-proof.mjs …` lines recorded inside canon `examples/**/evidence.yaml` assertions |
| `scripts/example-verify.mjs` | live | replay half of the evidence pair; referenced by `scripts/checks/check-example-work.mjs:156` (canon) and `example-evidence.mjs` docs; imports canon `check-example-work.mjs` + `example-ownership.mjs` |
| `scripts/ledger-migrate.mjs` | live | dynamic `import('../../scripts/ledger-migrate.mjs')` in `hosts/orca/launch.mjs:986`; listed in `sqlite/design.yaml`, `sqlite/index.yaml`; `cli/main.mjs` documents the `starci ledger-migrate` command |
| `scripts/plan.mjs` | live | SKILL.md:102 contract (`node scripts/plan.mjs template|create|render`); `docs/cli.md`; `renderPlan` imported by `present-goal.mjs` |
| `scripts/present-goal.mjs` | live | w5 report kept it as live-runtime; Plan v2 goal-presentation exporter importing canon `workflows/plan.mjs`, `workflows/storage.mjs`, `core/yaml.mjs`, `core/runtime-root.mjs` |
| `scripts/probe-reference-conventions.mjs` | live | canon `knowledge/patterns/scan-coverage.yaml:26` instructs `node scripts/probe-reference-conventions.mjs <backend-reference-root>` |
| `scripts/sanitize-orca-fixture.mjs` | live | produced canon `tests/fixtures/orca/live-1.4.188/*.json` — its `<orca-workspaces>`/`<repositories>`/`<redacted-hash>` markers are present in those fixtures; still the tool for refreshing them from live captures |
| `scripts/work-example.mjs` | live | referenced by canon `modules/schemas/index.yaml` (lines 56, 76); named evidence tool in `ex-testing/briefs/v7/*` |
| `scripts/work-remap-path.mjs` | live | `tests/work-remap-path.spec.mjs` imports `scanTree`/`applyScan`/`findTargetRoot`/`searchRoots` |
| `scripts/yaml-source.mjs` | **legacy** → `legacy/scripts-loose/yaml-source.mjs` | referenced only by `legacy/builders/build-yaml.mjs` (esbuild entry that generated `core/yaml.mjs`); builders already parked, SKILL.md declares distless layout with no build step; no canon importer |

Junk: none found in scope.

## Moves

- `git mv scripts/yaml-source.mjs legacy/scripts-loose/yaml-source.mjs` (history preserved, `R` in index).

## Broken imports fixed in scope

None — nothing in scope (or anywhere in canon) imported `scripts/yaml-source.mjs` as a module.

## needed_elsewhere (cross-scope, not touched)

- `legacy/builders/build-yaml.mjs:2` — esbuild `entryPoints:['scripts/yaml-source.mjs']` is now a stale path inside the parked builder (should read `legacy/scripts-loose/yaml-source.mjs` if ever revived). Owned by the builders lane; left alone per rules.
- `core/yaml.mjs:7365` — esbuild-generated `// scripts/yaml-source.mjs` source marker inside the checked-in bundle; harmless comment, editing generated text would diverge it from a rebuild. Informational only.

## w3 flag resolution

`scripts/plan.mjs:48` no longer does `distPath`/`JSON.parse` of yaml — it now streams `workflows/plan.template.yaml` for `template` and uses `parseYaml` (`core/yaml.mjs`) for `create`/`render` (line 49). Already fixed before this lane; no action needed.

## Verification

- `node --test tests/config.spec.mjs tests/example-derive.spec.mjs tests/example-critique.spec.mjs tests/work-consistency.spec.mjs tests/work-remap-path.spec.mjs` → 56 pass, 0 fail.
- Repo-wide grep for `yaml-source` post-move: only legacy/scratch/generated-comment hits remain (above).
- No new `.dist/` created by this lane; `knowledge/` untouched; no commit.
