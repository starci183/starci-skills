---
title: Business authority
---

# Business authority

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@feature-schema` | `contexts/business/schema.json` | file | refuse unsupported or untraceable business claims |
| `@registry-schema` | `contexts/business/registry.schema.json` | file | validate stable feature heads and immutable objects |
| `@business-registry` | `scripts/business-registry.mjs` | script | validate, hash, publish and check business snapshots |

## Record

The business root is the evidence-backed product model shared by frontend, backend and design work. It
records what the routed sources demonstrably do: actors, flows, rules, states, entities, operations,
surfaces, acceptance conditions and explicit unknowns. It never copies raw source or promotes a design
idea, sample document or agent inference into product truth.

## Law

Every project owns `<Source>/.worktrees/<project>/business`, a locked linked worktree on
`codex/business/<project>`. Stable `featureId` heads point to immutable SHA-256 objects. Each current
feature also publishes a machine-readable `model.json`, compact `CONTEXT.md`, task-routed Markdown
modules, aggregate `spec.md` and `evidence.json`.

Every claim that affects a flow, rule, state, API, surface or acceptance condition cites at least one
evidence row bound to a routed role and exact source head. Missing evidence becomes an `unknown`; it is
not representative content. A dirty target is allowed only when every dirty path is outside the cited
evidence boundary and the snapshot binds committed `HEAD`, never working-tree bytes.

Before a business-dependent skill reasons from a feature, it checks the current feature head against
the routed FE/BE heads. Missing or stale truth is refreshed by `starci-business-analyze`; a consumer
does not silently repair it. Design previews use the selected surface and region data from the current
business object, while layout remains impressionistic and block design still owns final anatomy.

## Rules

1. `featureId` is stable; its SHA-256 head is a version.
2. Business state is durable and versioned; generated preview packs remain under project cache.
3. FE and BE evidence is read from verified workspace routes at committed heads.
4. Every non-unknown claim cites evidence present in the same object.
5. Imported examples contribute shape only, never business facts.
6. `CONTEXT.md`, task modules, `spec.md` and `evidence.json` are generated views of `model.json`; only the immutable object is authority.
7. LLMs load `CONTEXT.md` first, then only the flow/surface modules required by the task.
8. A consumer refuses a stale feature rather than inventing representative data.
9. Updating business does not authorize product source changes.

## Output

```text
business: <project>/<featureId>@<hash>
sources: <role@head ...>
surfaces: <surface ids>
unknowns: <count>
path: .worktrees/<project>/business/features/<featureId>/
```
