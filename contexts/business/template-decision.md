# Business context template decision

## Chosen shape

Use a **context capsule plus task-routed modules** for every stable `featureId`:

```text
features/<featureId>/
├── CONTEXT.md
├── overview.md
├── actors.md
├── rules.md
├── states.md
├── contracts.md
├── acceptance.md
├── flows/<flowId>.md
├── surfaces/<surfaceId>.md
├── model.json
├── evidence.json
└── spec.md
```

`CONTEXT.md` is the only default prompt input. It contains the decision capsule, invariants, primary
flow, surface map, operation map, explicit unknowns and a LOADS router. The agent then reads only the
one flow or surface involved in its task. `model.json` is the canonical machine projection;
`evidence.json` is the provenance projection; `spec.md` is a generated full view for humans.

## Why this is strongest for LLM context

1. **High signal at the prompt front.** Identity, source heads, purpose, actor, outcome, invariants and
   unknowns appear before detail.
2. **Progressive disclosure.** A layout task loads a surface; a mutation task loads a flow and contract;
   neither pays for unrelated feature prose.
3. **Stable retrieval keys.** Feature, flow, surface, rule, state, operation and evidence IDs give agents
   exact anchors instead of fuzzy heading search.
4. **Truth and rendering share one model.** Prototype content comes from surface regions in `model.json`,
   while prose remains readable and does not become a second authority.
5. **Staleness is measurable.** Every snapshot binds routed repository heads and exact evidence ranges.

## Rejected shapes

- **One monolithic SPEC.** Easy to browse, but repeats context, forces full-file loading and makes
  unrelated edits invalidate every consumer.
- **One file per fact.** Precise but fragments causal context, increases retrieval calls and makes it
  difficult to understand a complete user journey.
- **Markdown-only authority.** Friendly to humans but weak for deterministic validation, hashing,
  rendering and dangling-reference checks.
- **JSON-only authority.** Strong for machines but expensive for human review and poor as a concise LLM
  entry point.

## Loading recipes

| Task | Required context |
|---|---|
| Layout | `CONTEXT.md` + one `surfaces/<surfaceId>.md` |
| Block anatomy | layout recipe + linked `flows/<flowId>.md` when interaction matters |
| Backend plan | `CONTEXT.md` + affected flow + `contracts.md` + `rules.md` |
| Frontend execute | accepted design + `CONTEXT.md` + affected surface/flow |
| Audit | `model.json` + `evidence.json` + cited source ranges |

The reusable authored skeleton lives at
`skills/starci-business-analyze/assets/feature-template/`. Published files are generated from the
validated immutable object and must not be hand-edited.
