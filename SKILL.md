---
name: starci
description: Complete one StarCi mission by freezing its scope, selecting the one operator that owns the outcome, and routing between operators on typed results until the outcome is proved or a person must decide.
---

# StarCi

One entry, fourteen operators, one closed routing map. This file selects the first operator and
sequences the rest. It does no work of its own: it never decides a value, writes source, or judges a
result.

## Setup

1. Freeze one mission scope: the unit, the target, inclusions and exclusions, write roots, external
   effects, and what will count as proof. Two readings that would change any of those is one focused
   question, not a guess.
2. Run `workspace.bind` for any mission that reads or writes routed source. Nothing else may resolve a
   checkout, and a similar directory name is never route authority.
3. Select the first operator from the table below. Read only that operator's `operator.json`,
   `context.md`, `input.md`, and `execute.md`.
4. Run that operator, end to end, on the one profile its `operator.json` names under `resources`, with
   only the grants it lists. An operator has no other model, no inherited turns, and no grant the
   assignment omits.

## Entry

| The request is about | First operator |
| --- | --- |
| Which project, checkout, or runtime binding applies | `workspace.bind` |
| What the product promises, who may have it, what happens when it fails | `business.decide` |
| System boundaries, data ownership, or the tech stack | `architecture.decide` |
| Server behaviour, an API contract, persistence, or a job | `backend.implement` |
| Creating, restructuring, or redesigning a page or surface | `fe.direction.decide` |
| Which CSS value an already-composed tree takes | `fe.presentation.resolve` |
| Writing an already-resolved tree into product source | `fe.source.apply` |
| Whether a rendered surface actually holds up | `fe.surface.audit` |
| Build, lint, typecheck, coverage, or Sonar | `quality.verify` |
| Whether a real person can complete a real journey | `uat.verify` |
| Shipping a release, or recovering one | `release.deploy` |
| Observability, Sonar service, or a tunnel | `platform.operate` |
| An educational content unit | `content.generate` |
| Publishing an approved Git boundary | `git.publish` |

A request that names no owner, or two owners whose scopes differ materially, stops here with one
focused question naming the competing boundaries.

## The loop

```text
build input -> validate-input.mjs -> execute -> validate-output.mjs -> route
```

Routing reads two fields of a validated output and nothing else:

1. A success outcome advances the mission to the next operator its plan names.
2. `blocked` reads `failure.owningDomain` and resolves it in `routing.json`:
   - `operator` invokes the named operator, then returns here;
   - `resume` invokes the same operator again with the delta its resume token requires;
   - `user` stops and reports what the person must decide or publish;
   - `external` stops and reports what outside the runtime must change.
3. `uat.verify` returning `failed` and `release.deploy` returning `rolled-back` are decided results,
   not blocks. They carry their own owner and route the same way.

An output that fails its validator does not route. Prose in a receipt does not route. A narrated
outcome does not route. Only a validated field does.

`routing.json` is closed and checked: every domain an operator can emit has exactly one route, and no
route names a domain it never emits. A missing route is a build failure, not a judgement call.

## Progress

Every operator carries its own resume and fingerprint semantics, so this file holds no progress
counter and no handoff state. A `resume` route that returns `NO_PROGRESS` means the same input
reached the same wall: report the wall rather than trying again.

A cycle between two operators is valid only while the progress fingerprint changes. A repeated
fingerprint, or the same material finding twice, ends the loop and reports the smaller owner.

## Authority

This file grants nothing. Every authority boundary is enforced by the operator's own schema, which
this file cannot widen:

- `git.publish` pins `forcePush` and `historyRewrite` to `false`, so no valid input describes a force
  push, a bypassed hook, a reset, a clean, a stash, or a branch deletion.
- `release.deploy` requires its declared authorization, scoped to the environment and unexpired.
- `uat.verify` accepts no free-form string in its account record, so a credential cannot be written
  into a snapshot.
- `fe.presentation.resolve` and `fe.surface.audit` may name only rule identifiers the bound knowledge
  publishes.

If a mission seems to need more than an operator allows, that is the answer, not an obstacle to route
around.

## Knowledge

Operators bind their own knowledge; this file does not preload it.

| Folder | Bound by |
| --- | --- |
| `knowledge/ui/composition/` | `fe.direction.decide` |
| `knowledge/ui/presentation/` | `fe.presentation.resolve` |
| `knowledge/ui/proof/` | `fe.surface.audit` |
| `knowledge/patterns/fe/`, `knowledge/patterns/be/` | `fe.source.apply`, `backend.implement` |
| `knowledge/grammars/<family>/` | every operator that composes that family |

English `.md` files are the only runtime authority. Same-stem `.vi.md` files are human mirrors and
never enter a context manifest, a dependency list, a validator input, or an operator binding.

## Orchestration

One invocation of one operator is one agent, created fresh on the profile its `operator.json` names,
with the grants and the refs it declares and nothing else. `resources/orchestrator.json` fixes the
rules: at most three agents at once, never two agents sharing a writable location, dispatch by
`routing.json`, hand-off only through the typed receipt under `@artifacts`. An agent never starts
another agent; a critique inside an operator is a step of the same agent. `refs.json` is the one
place an alias resolves to a location; an operator reads only what its Refs table names.
