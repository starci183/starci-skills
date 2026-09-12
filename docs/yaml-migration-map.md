# YAML migration map (declarative JSON inventory)

Inventory-only. No files were converted or deleted for this document. Knowledge topic YAML is already migrated and is out of scope except the calibration exception. Operator contracts under `ops/` are already authored as YAML; only generated op JSON remains beside source.

Classification keys:

| Class | Meaning |
| --- | --- |
| **authored-declarative → YAML** | Hand-authored skill/contract data still present as JSON; migrate to YAML (or drop JSON once a YAML twin is sole authority), emit runtime JSON under `.dist` only. |
| **generated → `.dist` only** | Produced by a named generator; do not treat as authored YAML. Prefer materializing only under `.dist` (some still write beside sources today). |
| **already YAML** | Authored source already `.yaml`; listed for completeness, not a JSON offender. |
| **executable / native / prose → keep** | Code, local prefs, or non-declarative artifacts; not YAML migration targets. |
| **required-json → exception** | Must remain authored JSON; listed exactly in [`schemas/json-exceptions.yaml`](../schemas/json-exceptions.yaml). |
| **external-format fixture** | Retain authored JSON only when tests assert JSON bytes; none found under `tests/fixtures`. |

Machine check: `node scripts/check-json-exceptions.mjs` (see end).

---

## Counts by class (source tree; excludes `.dist/**` and `node_modules`)

| Class | Count |
| --- | ---: |
| authored-declarative → YAML (JSON still on disk) | 35 |
| generated → `.dist` only (still present beside source) | 19 |
| required-json → exception | 10 |
| already YAML (ops authored + root twins) | ops contracts + `INDEX.yaml` / `README.yaml` / `UPDATE.yaml` / `config.example.yaml` / `fixtures/forward-goal-report.yaml` (see sections) |
| local runtime JSON (gitignored; not skill allowlist) | `config.json` when present — always JSON per `docs/config-format.md` |
| external-format fixture (JSON bytes under test) | 0 |

Checker offenders today should match the **35** authored-declarative JSON paths (generated and allowlisted paths excluded; `tests/` not walked).

---

## Root metadata

| Path | Class | Notes |
| --- | --- | --- |
| `INDEX.yaml` | already YAML | Layout / folder map; prefer as sole authority. |
| `INDEX.json` | authored-declarative → YAML | JSON twin still present; retire after consumers read YAML/`.dist`. |
| `README.yaml` | already YAML | Machine readme twin. |
| `README.json` | authored-declarative → YAML | Still listed in `package.json` `files`; retire with packaging update. |
| `UPDATE.yaml` | already YAML | Maintainer document twin. |
| `UPDATE.json` | authored-declarative → YAML | JSON twin pending retirement. |
| `config.example.yaml` | already YAML | Template twin. |
| `config.example.json` | authored-declarative → YAML | Still used by `scripts/config.mjs` / build copy today. |
| `config.json` | local runtime JSON | Always JSON (`docs/config-format.md`); gitignored; checker skips; not a packaged allowlist entry. |
| `package.json` | required-json | npm manifest. |
| `package-lock.json` | required-json | npm lockfile. |

---

## `ops/`

### Authority and generation

- **Authored (already YAML):** `ops/registry.yaml`, `ops/common.yaml`, `ops/<id>/operator.yaml`, plus `specification.yaml` / `secondary.yaml` where present. `ops/contracts.mjs` reads YAML via `parseYaml`.
- **Generator:** `ops/generate.mjs` (inputs from `ops/contracts.mjs` + `ops/role-authority.mjs`) now returns in-memory JSON for the unified build. The following old source outputs are retired:
  - `ops/catalog.json`
  - `ops/basic-ops.json`
  - `ops/consolidation.json`
  - `ops/<id>/authority.json` for every registered op
- **Build consumer:** `scripts/build-workflows.mjs` validates the generated map and authored YAML, then publishes only `.dist`. Source-tree generation is no longer supported.

| Path | Class | Notes |
| --- | --- | --- |
| `ops/registry.yaml` | already YAML | Op id list + consolidation registry. |
| `ops/common.yaml` | already YAML | Shared operator policy (`commonDocument` target after build). |
| `ops/*/operator.yaml` (14) | already YAML | Per-op contract; sole authority. |
| `ops/architecture.decide/specification.yaml` | already YAML | Spec policy. |
| `ops/business.decide/specification.yaml` | already YAML | Spec policy. |
| `ops/interface.implement/secondary.yaml` | already YAML | Secondary-call policy. |
| `ops/catalog.json` | generated → `.dist` only | Owner: `ops/generate.mjs` via `ops/contracts.mjs`. |
| `ops/basic-ops.json` | generated → `.dist` only | Owner: `ops/generate.mjs` (`ops/basic-ops.mjs` view). |
| `ops/consolidation.json` | generated → `.dist` only | Owner: `ops/generate.mjs` (from `registry.consolidation`). |
| `ops/*/authority.json` (15) | generated → `.dist` only | Owner: `ops/generate.mjs` + `ops/role-authority.mjs`. |

Operator directories:
`architecture.decide`, `backend.implement`, `business.decide`, `content.generate`, `e2e.verify`, `interface.draw`, `interface.implement`, `knowledge.repair`, `release.deliver`, `review.verify`, `runtime.operate`, `scope.retire`, `task.execute`, `uat.verify`, `workspace.manage`.

---

## `workflows/`

All twelve JSON files are **authored-declarative → YAML**. Runtime/tests currently `JSON.parse` them from source; build copies into `.dist`.

| Path | Class |
| --- | --- |
| `workflows/auto.json` | authored-declarative → YAML |
| `workflows/catalog.json` | authored-declarative → YAML |
| `workflows/contracts.json` | authored-declarative → YAML |
| `workflows/delegation.json` | authored-declarative → YAML |
| `workflows/flash.json` | authored-declarative → YAML |
| `workflows/frontend.json` | authored-declarative → YAML |
| `workflows/gates.json` | authored-declarative → YAML |
| `workflows/jobs.json` | authored-declarative → YAML |
| `workflows/matrix.json` | authored-declarative → YAML |
| `workflows/plan.json` | authored-declarative → YAML |
| `workflows/plan.template.json` | authored-declarative → YAML |
| `workflows/transitions.json` | authored-declarative → YAML |

Companion `workflows/*.mjs` stay executable.

---

## `profiles/`

| Path | Class | Notes |
| --- | --- | --- |
| `profiles/registry.json` | authored-declarative → YAML | Profile catalogue. |
| `profiles/claude.json` | authored-declarative → YAML | Host profile. |
| `profiles/codex.json` | authored-declarative → YAML | Host profile. |
| `profiles/select.mjs` | executable → keep | |

---

## `schemas/`

Declarative shapes consumed via `JSON.parse` today (`core/index.mjs`, `compile-knowledge.mjs`, CLI, etc.). Migrate to YAML; not npm/tsc-native.

| Path | Class |
| --- | --- |
| `schemas/code-example-catalog.schema.json` | authored-declarative → YAML |
| `schemas/code-example-manifest.schema.json` | authored-declarative → YAML |
| `schemas/goal.schema.json` | authored-declarative → YAML |
| `schemas/knowledge-rule.schema.json` | authored-declarative → YAML |
| `schemas/knowledge-source.schema.json` | authored-declarative → YAML |
| `schemas/profiles.json` | authored-declarative → YAML |
| `schemas/work-layout.json` | authored-declarative → YAML |
| `schemas/work.schema.json` | authored-declarative → YAML |
| `schemas/workspace-routing.json` | authored-declarative → YAML |
| `schemas/json-exceptions.yaml` | keep (this allowlist; YAML) | |

---

## `specifications/`

| Path | Class | Notes |
| --- | --- | --- |
| `specifications/contract.json` | authored-declarative → YAML | Copied into `.dist` by build. |
| `specifications/sds.schema.json` | authored-declarative → YAML | SDS shape; `sds.mjs` / validate. |
| `specifications/*.mjs` | executable → keep | |

---

## `contracts/`

No `*.json`. Only `contracts/assets.mjs`, `contracts/journeys.mjs` → **executable → keep**.

---

## `core/`

| Path | Class | Notes |
| --- | --- | --- |
| `core/README.json` | authored-declarative → YAML | Packaged/copied by `build-workflows.mjs`; YAML twin `core/README.yaml` preferred. |
| `core/yaml-license.json` | required-json | License metadata for bundled `core/yaml.mjs`; `scripts/compile-declarative.mjs` excludes it from YAML→`.dist` projection. Also mirrored in `THIRD_PARTY_NOTICES.md`. |
| `core/index.mjs`, `core/yaml.mjs` | executable → keep | |

---

## `docs/`

| Path | Class | Notes |
| --- | --- | --- |
| `docs/catalog.json` | generated → `.dist` only | Owner: `scripts/build-docs.mjs` (also writes site catalog). |
| `docs/*.md` | prose → keep | Human docs (including this map). |

---

## `examples/`

| Path | Class |
| --- | --- |
| `examples/nivo-service-routing.json` | authored-declarative → YAML |
| `examples/nivo-setup-architecture.json` | authored-declarative → YAML |
| `examples/nivo-setup-business.json` | authored-declarative → YAML |
| `examples/nested-business/**/*.yaml` | already YAML | Nested Work example tree. |

---

## `fixtures/`

| Path | Class | Notes |
| --- | --- | --- |
| `fixtures/forward-goal-report.yaml` | already YAML | Preferred authored synthetic report (`starci/fixture-report@1`). |
| `fixtures/forward-goal-report.json` | authored-declarative → YAML | JSON twin pending retirement; **not** a wire fixture (no test asserts JSON bytes). |
| `fixtures/forward-goal/**/*.yaml` | already YAML | Workspace draft fixture. |
| `fixtures/*.mjs` | executable → keep | |

---

## `knowledge/` (exception only)

Knowledge topics are YAML → `.dist` JSON via `scripts/compile-knowledge.mjs`. Do not re-author topics as JSON.

| Path | Class | Notes |
| --- | --- | --- |
| `knowledge/ui/proof/calibration/calibration.json` | required-json | Explicit dataset exception; compiler rejects any other authored `knowledge/**/*.json`. |
| All other `knowledge/**/*.yaml` | already YAML | Out of scope for conversion in this task. |

---

## `sites/` (tooling JSON)

| Path | Class | Notes |
| --- | --- | --- |
| `sites/docs/package.json` | required-json | |
| `sites/skills/package.json` | required-json | |
| `sites/skills/package-lock.json` | required-json | |
| `sites/skills/tsconfig.json` | required-json | tsc/Vite native. |
| `sites/skills/tsconfig.app.json` | required-json | |
| `sites/skills/tsconfig.node.json` | required-json | |
| `sites/skills/src/catalog.generated.json` | generated → `.dist` only | Owner: `scripts/build-docs.mjs` (currently under `sites/skills/src/`). |

Excluded from walks: `sites/**/node_modules`, `sites/**/.next`, `sites/**/out`.

---

## `tests/fixtures`

No authored `*.json` wire fixtures. Fixtures are YAML (and `quality-source.spec.mjs`). **external-format fixture → none.** Do not invent JSON fixtures on the allowlist.

---

## Allowlist paths (`schemas/json-exceptions.yaml`)

Exact paths only (sorted):

1. `core/yaml-license.json`
2. `knowledge/ui/proof/calibration/calibration.json`
3. `package-lock.json`
4. `package.json`
5. `sites/docs/package.json`
6. `sites/skills/package-lock.json`
7. `sites/skills/package.json`
8. `sites/skills/tsconfig.app.json`
9. `sites/skills/tsconfig.json`
10. `sites/skills/tsconfig.node.json`

Verified non-exceptions: `fixtures/forward-goal-report.json` (YAML twin exists; no JSON byte assertion); no other `tests/fixtures/**/*.json` wire targets. Local `config.json` stays JSON but is gitignored and skipped by the checker (not a packaged exception).

---

## Checker

```sh
# From this skill directory (.claude)
node scripts/check-json-exceptions.mjs

# Optionally skip package-lock.json paths (neither require nor fail on them)
node scripts/check-json-exceptions.mjs --ignore-lockfiles
```

Behavior:

- Loads `schemas/json-exceptions.yaml` via `core/yaml.mjs` (`parseYaml`).
- Walks the skill tree; skips `.git`, `.dist`, `dist`, `node_modules`, `.next`, `out`, `tests`, and local `config.json`.
- Skips the known **generated** paths listed in the script (ops catalogue/authority, `docs/catalog.json`, `sites/skills/src/catalog.generated.json`) so they are not mistaken for authored sources.
- Exports `checkJsonExceptions({ root, allowlistFile })` for tests/fixtures.
- **Exit nonzero** listing every other `*.json` not on the allowlist (expected until those files are converted or JSON twins removed).
- Also fails if an allowlisted path is missing on disk (unless `--ignore-lockfiles` for lockfiles).

Current expected failure: **35** authored-declarative offenders until migration completes.
