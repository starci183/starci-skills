# Business authority

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@feature-schema` | `contexts/business/schema.json` | file | refuse unsupported or untraceable business claims |
| `@registry-schema` | `contexts/business/registry.schema.json` | file | validate stable feature heads and immutable objects |
| `@business-registry` | `scripts/business-registry.mjs` | script | validate, hash, publish and check business snapshots |
| `@template-decision` | `contexts/business/template-decision.md` | file | choose the LLM loading shape and reject weaker alternatives |

## Record

The project business root is the evidence-backed product model shared by FE, BE and design. It records
actors, flows, rules, states, entities, operations, surfaces, acceptance conditions and explicit unknowns.

## Law

`<Source>/.worktrees/<project>/businesses` is a locked linked worktree on `codex/businesses/<project>`.
Stable `featureId` heads point to immutable SHA-256 objects. Current `model.json`, compact `CONTEXT.md`,
task-routed modules, aggregate `spec.md` and `evidence.json` are views of that object. Every claim cites exact routed source evidence; missing
evidence is an `unknown`, never representative content. Consumers check source heads before use and
refuse stale truth. Imported examples provide structure only.

## Rules

1. `featureId` is stable; hash is version.
2. Business is durable; previews are rebuildable cache.
3. Evidence binds routed role, committed head, path and line range.
4. Dirty paths may exist only outside all cited evidence.
5. LLMs load `CONTEXT.md` first, then only the flow/surface module needed by the task.
6. Design previews use current business surfaces/regions but do not decide block anatomy.
7. Updating business does not authorize product source writes.

## Output

```text
business: <project>/<featureId>@<hash>
sources: <role@head ...>
surfaces: <surface ids>
unknowns: <count>
path: .worktrees/<project>/businesses/features/<featureId>/
```
