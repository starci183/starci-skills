# TINKLE-FINAL — modules/ coherence sweep (tinkle-5, consolidated into w6)

Wait gate: `tinkle-1..4.done` all present; amendment gate `tinkle-6.done` present.
All v11-format dependencies (v10-1..5, v9-2..10, v11-1..4) are also done.

## What `modules/` now contains

| Dir | Holds |
|---|---|
| `modules/ops/` | `ops/<id>.yaml` — 30 op manifests (verbatim `operator.yaml` port + `business:` + `route:` blocks); `registry.yaml` — GENERATED, `build-ops-registry.mjs --check` → "current (30 ops)" |
| `modules/models/` | `kinds.yaml`, `runtimes.yaml`, `registry.yaml`, `capabilities.yaml`, `qualifications.yaml`, `records.yaml`, `code-patterns.yaml`, per-provider files, `profiles/*.yaml` (7), `selection.yaml` (declarative selection source of truth), `index.yaml` |
| `modules/goal/` | `anatomy.yaml`, `archetypes.yaml`, `existing.yaml`, `legality.yaml` — PARSE→SURVEY→GAP→CHAIN→VALIDATE goal-chain rules |
| `modules/kernel/` | `driver-loop.yaml`, `dispatch.yaml` (packet contract), `verdict-contract.yaml` — the [Kernel]/[Op] operating model as data |
| `modules/schemas/` | `index.yaml` + `relationships.yaml` — catalog mapping every schema id → authored source → consumers |

All 62 `modules/**/*.yaml` parse with `core/yaml.mjs` (0 failures).

## Coverage verification

| Check | Result |
|---|---|
| `modules/ops/registry.yaml` vs `ops/` dirs | **30/30 exact match** (`diff` clean); `--check` says registry is current |
| `modules/models/` runtimes vs `.dist/model/runtimes.json` | **5/5 covered**: codex-agent, claude-agent, claude-fable, qwen-agent, devin-agent; `model/runtimes.yaml` and `modules/models/runtimes.yaml` are byte-identical |
| `modules/schemas/index.yaml` vs `schemas/*.yaml` | **45/45** — every authored schema file catalogued, none extra (the brief's "schemas/index.yaml" resolves here per the file's own note: `schemas/` is canon source, the catalog lives in `modules/`) |
| `check-example-work.mjs` (gate) | exit 0 — 261 records, 3138 refs, 127 evidence, 44 payloads skipped; the moves broke nothing |
| `check-work-deep.mjs` | exit 0 — 0 refused, 2 suspect, 3 info (pre-existing CAPABILITY_WITHOUT_SPEC on /health + /webhooks and EVIDENCE_CONTEXT_MISSING) |

## Resolver verification (tinkle-5 amendment)

`route-op.mjs` on 3 inputs:

1. `--kind backend.implement --nodeKind implementation --phase implementation` →
   PICK `backend.implement` (1015), prerequisites `business.decide done, architecture.decide done`. Correct.
2. `--nodeKind uat --phase post-implementation --intent verify,evidence` → PICK
   `work.author` (10) over `uat.verify` (7) — see gap G1 below.
3. `--kind interface.draw --nodeKind ui` → PICK `interface.draw` (1010),
   riskHints `host-tool-required:image_gen.imagegen`. Correct.

`route-model.mjs` on 3 inputs:

1. `--kind backend.implement` → PICK `qwen-agent` (qwen3.8-flash, mode=probation);
   qualifications store is empty so probation is the honest verdict, not a silent
   upgrade. Fallback order devin→claude→codex per registry chain. Correct.
2. `--kind uat.verify --role verify --risk high` → typed REFUSAL "no eligible
   model": probation cannot satisfy elevated risk. Fail-closed, correct.
3. `--kind interface.draw --role write --tools image_gen.imagegen` → PICK
   `codex-agent` — the only pool carrying ImageGen. Matches goal.md's routing law.

## Gaps still open

- **G1 — nodeKind vocabulary split on `uat`.** `uat.verify` routes on
  `nodeKinds: [uat.ux]` while `work.author` claims bare `uat`; a bare-`uat` query
  lands on `work.author`. Either `uat.verify` should also claim `uat`, or the
  vocabulary should declare that uat nodes are always `uat.ux`. Route-key
  question for the modules/ops owners — reported, not patched (per amendment).
- **G2 — stale evidence path.** One recorded assertion still names
  `../../scripts/check-scoped-lint.mjs` (pre-tinkle-4 location); replay refuses it
  honestly. Re-record under `scripts/checks/` (example lanes' scope).
- **G3 — todo `_derived/index.yaml` stale** vs current records; regenerate via
  `example-derive.mjs --write` (example lanes' scope).
- **G4 — `model/` and `ops/` still exist** beside `modules/` pending the
  w3/w4 `git mv` to `legacy/`; `.dist/` still present pending w7. Not module gaps.

## Business-analysis spot-check (does an agent route correctly from the yaml?)

- `business.decide`: *"What must the product observably do — actors, flows, rules,
  policy decisions, data, customer journeys, acceptance — stated so an implementer
  and an acceptor need no guesses?"* whenNot explicitly bars technical design
  ("that is architecture.decide"). **Routable** — question/when/whenNot/prereqs
  all present.
- `backend.implement`: *"Does the actual backend code implement the selected
  accepted operations and ACs — and prove it with unit + backend E2E + quality
  gates?"* — whenNot bars frontend, UAT, deploys, and names the SDS-gap escape
  (architecture.decide secondary). **Routable.**
- `release.deliver`: *"Is the one explicitly selected publish/deploy/migrate
  effect delivered — and is its remote outcome actually verified?"* — "No mode
  selected = no authority". **Routable and honest about authority.**
- `modules/models/profiles/codex-agent.yaml`: *"Which pool judges the work others
  did, and which pool can draw?"* — whenNeeded names the verify-first seat and the
  sole imagegen route; whenNot says it is deliberately NOT the first implement
  pick. An agent can select it correctly from the profile alone. **Routable.**

Verdict: the `business:` blocks answer the NGHIỆP VỤ questions — what, when,
when-not, who-picks — with cited sources, not transcription.
