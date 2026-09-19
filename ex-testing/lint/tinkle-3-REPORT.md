# Lane tinkle-3 — schemas/ consolidation map: REPORT

Date: 2026-09-19. Scope: `.claude/schemas/` (canon) + `.claude/.dist/schemas/` (compiled projection).

## Deliverables

- `modules/schemas/index.yaml` — 45-entry catalog: one entry per authored file in `schemas/`,
  each with {id (the record's `schema:` const), file, dist artifact, distState, dialect,
  subsystem, governs, binds, usedBy, business{question,whenNeeded,whenNot,selectedBy}}.
  Plus `gaps[]` and a `coverage` block.
- `modules/schemas/relationships.yaml` — 39 typed edges: schema→schema (pairs-with,
  delegates, governs, emits/consumes, supersedes, mirrors) and schema→subsystem
  (work-tree, kernel, ops, engine, gate, routing, stacks, providers, model, knowledge, build).
- No schema bodies duplicated — catalog + analysis only, per the brief.

## Branch taken: canon source EXISTS outside .dist

`schemas/*.yaml` (45 files) is the authored tree; `.dist/schemas/*.json` is compiled by
`scripts/compile-declarative.mjs` `collectDeclarativeTree(dir='schemas', recursive=false,
excludeRelative={json-exceptions.yaml})`. So the index maps id → authoritative source →
.dist artifact → governs, per the brief's first branch.

## Output-location deviation (deliberate)

Brief text says "produce `.claude/schemas/`", but `schemas/` is the canon source and the
declarative compile projects **every** yaml in it into `.dist` (json-exceptions.yaml is the
only exclusion). Writing `index.yaml`/`relationships.yaml` there would publish them as
`.dist/schemas/*.json` inside the sealed runtime contract tree — two non-schema files
masquerading as contracts. TINKLE's mandate is `.claude/modules/`, so the catalog lives at
`modules/schemas/` beside `modules/ops/` (tinkle-1) and `modules/models/` (tinkle-2);
tinkle-5's `schemas/index.yaml` coverage check resolves to `modules/schemas/index.yaml`.

## Key findings

- **.dist is stale today.** `node scripts/compile-declarative.mjs --check` reports 21 stale
  entries: all 17 `work-*.schema.yaml` (the Work v2 per-record family, authored 2026-09-19
  ~03:41) have **no .dist artifact yet**, and 4 sources (application-stacks, source-layout,
  stacks-layout, work-layout) differ from their artifacts. `ensure-build` rebuilds on demand;
  index entries carry `distState: pending-build|stale-content|present|excluded` to mark the
  actual state.
- **Two Work generations coexist.** v1 monolith `work.schema.yaml` (versioned ids:
  `work/workspace@1`, `work/node@2`, `work/resource@1`, `work/evidence@1`,
  `work/disposable-accounts@1`, `starci/source-identity@1`, `starci/design-review@1`) beside
  the v2 unversioned `work/<kind>` per-family files. Record's own `schema:` const picks the
  authority.
- **Coverage gaps (observed, in `index.yaml gaps[]`):** `work-layout@3` declares 15 families;
  `work/contract`, `work/integration`, `work/gap`, `work/event` have no per-family schema
  (check-work-consistency.mjs's own comment confirms the contract/integration half).
  `starci/workflow-goal@1` (kernel GOAL_RECORD) and `starci/code-pattern-script@1` (per-script
  check output) are live record kinds with no dedicated schema file.
  `starci/evidence-packet@1` is listed in model/kinds.yaml, unfiled here.
- **Two dialects:** draft-2020-12 JSON Schema (`$schema`/`$id`/`$defs`, machine-checkable) and
  prose-contract YAML (`schema:`/`purpose:`/`fields:`/`rules:`, read-and-honoured by agents —
  e.g. op-io, work-layout, supervision). Both compile to `.dist/*.json` the same way.
- **usedBy is thin by design:** most schemas bind records/documents, not call sites. Direct
  loaders found: core/index.mjs (work.schema, profiles), workflows/source-layout.mjs
  (source-layout), build-workflows.mjs (work-layout), compile-knowledge.mjs (knowledge +
  code-example set), checks/stacks.mjs (application-stacks), check-work-consistency.mjs
  (work-<family> by name construction), check-stales/source-staleness.mjs, kernel/store,
  amendment, reports, candidate-bridge, providers/validate + orca/headless hosts (orca-calls),
  execution/contracts+api (request/receipt). The rest are agent-facing contracts enforced by
  docs + gates rather than a single loader — recorded as such, not invented.

## Verification

- Both files parse under the repo's own strict parser (`core/yaml.mjs` parseYaml — YAML 1.2,
  uniqueKeys, strict). Fixed: 2 unquoted `: ` scalars, 5 flow-seq `: ` items, 1 backtick-leading
  scalar (reserved indicator).
- Catalog count = 45 = `ls schemas/*.yaml | wc -l`. Every .dist artifact (27) has a mapped
  source; every authored file has an entry.
- `git status` on `schemas/`/`modules/` shows only the two new files under modules/ — the
  canon tree is untouched.

## Residuals

- tinkle-5 should confirm `modules/schemas/index.yaml` covers every .dist schema (27 present +
  21 stale-or-missing documented). If the fleet later wants the catalog inside `schemas/`, it
  needs an `excludeRelative` entry in compile-declarative.mjs first.
- `.dist` staleness is a pre-existing repo state, not caused by this lane; flagged for whoever
  owns the next build.
