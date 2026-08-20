# Business authority

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@feature-schema` | `contexts/business/schema.json` | file | refuse unsupported or untraceable business claims |
| `@registry-schema` | `contexts/business/registry.schema.json` | file | validate stable feature heads and immutable objects |
| `@business-registry` | `scripts/business-registry.mjs` | script | validate, hash, publish and check business snapshots |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove an exact head authorizes or forbids source writes |

## Record

The business root is the sole product-truth authority shared by frontend, backend, design and every
other routed repository. It records both the last implemented truth and explicit owner-approved intent.
Product source proves implementation; it never silently defines a different product truth.

## Law

Every project owns `<Source>/.worktrees/<project>/businesses`, a locked linked worktree on
`codex/businesses/<project>`. Stable `featureId` heads point to immutable SHA-256 objects. Each current
feature also publishes a machine-readable `model.json`, compact `CONTEXT.md`, task-routed Markdown
modules, aggregate `spec.md` and `evidence.json`.

Every claim that affects a flow, rule, state, API, surface or acceptance condition cites at least one
evidence row bound to a routed role and exact source head. Missing evidence becomes an `unknown`; it is
not representative content. A dirty target is allowed only when every dirty path is outside the cited
evidence boundary and the snapshot binds committed `HEAD`, never working-tree bytes.

Schema-v2 authority has exactly four states. `pending` is accepted intent whose implementation has not
opened. `in-progress` is the exact intent currently allowed to change source. `implemented` is reconciled
truth bound to final committed source heads. `rejected` is retained decision history and never authorizes
source work. `baseHead` points to the most recent implemented truth; `previousHead` proves the immediate
workflow transition. Legacy schema-v1 heads are read as `implemented`.

The only valid forward transitions are `implemented → pending → in-progress → implemented`, with
`pending|in-progress → rejected` and `rejected → pending`. A business-affecting product write requires
the matching feature head to be `in-progress` before the first write. After code and gates, the feature
must be reconciled to `implemented` against final committed source heads. A purely technical change
declares `businessImpact: none`, binds the current implemented head, and does not create a fake feature.

## Rules

1. `featureId` is stable; its SHA-256 head is a version.
2. Business state is durable and versioned; generated preview packs remain under project cache.
3. FE and BE evidence is read from verified workspace routes at committed heads.
4. Every non-unknown claim cites evidence present in the same object.
5. Imported examples contribute shape only, never business facts.
6. `CONTEXT.md`, task modules, `spec.md` and `evidence.json` are generated views of `model.json`; only the immutable object is authority.
7. LLMs load `CONTEXT.md` first, then only the flow/surface modules required by the task.
8. Every routed repository trusts the business head and reads its authority status before acting.
9. `pending` can drive design and planning; only `in-progress` authorizes business-affecting source writes.
10. `rejected` never describes runtime truth and never authorizes implementation.
11. Creativity runs first inside accepted intent, then principles review, source patterns, code and gates.
12. Updating business alone does not authorize unrelated product source changes.

## Output

```text
business: <project>/<featureId>@<hash>
sources: <role@head ...>
surfaces: <surface ids>
unknowns: <count>
path: .worktrees/<project>/businesses/features/<featureId>/
```
