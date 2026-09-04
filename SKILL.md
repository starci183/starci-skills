---
name: starci
description: Complete one StarCi mission by freezing its scope, selecting the one operator that owns the outcome, and routing between operators on typed results until the outcome is proved or a person must decide.
---

# StarCi

One entry, fourteen operators, eight example workflows, one closed routing map, one tool registry. This file picks the
workflow or composes one, selects the first operator, and sequences the rest. It does no work of its own: it never decides a value, writes source, or judges a
result.

## Setup

Before communicating a question, apply [the interaction policy](resources/interaction.md).
This changes communication only: all routing transitions, operator boundaries and required
authorizations below remain in force. An Ask column or diagnostic reason is not a prompt to forward.

1. Freeze one mission scope: the unit, the target, inclusions and exclusions, write roots, external
   effects, and what will count as proof. Two readings that would change any of those is one focused
   question, not a guess.
2. Run `workspace.bind` for any mission that reads or writes routed source. Nothing else may resolve a
   checkout, and a similar directory name is never route authority.
3. Look for a workflow first: read the `when` of every example in `workflows/`. A full match is run as
   written, its presets filling `request.json`. The examples are references, not the only chains
   there are: when the match is partial, or the business is harder than any `when` describes, the
   entry brainstorms its own chain from the operators' `## Next` tables under the rules
   `workflows/README.md` states (required inputs produced earlier, no shared write alias inside a
   step, loops capped, a declared end) rather than bending a near-miss example into shape; a composed
   chain worth keeping becomes a new example. Every chain, written or composed, obeys the same
   long-flow law: a chain that writes frontend source under `mode: apply` proves the surface with
   `frontend.surface.audit` and walks it with `uat.verify` before it reaches `git.publish`, and a
   chain that delivers any user-facing flow does the same, because a delivery nobody looked at and
   nobody walked through is not a delivery.
4. Create the session before anything else happens. Nothing is designed, written or committed outside
   a session: the first act of a mission that will write anything is, in order, the session folder,
   the branch the route's git policy names for session work, and a validated `request.json` — never a
   question put to a person about whether to open one or which of those to do, because the tree has
   already answered both, and never something done after the first write. Before any file outside the
   session folder is read in order to change it, and before any file outside the session folder is
   written, `<Source>/.worktrees/sessions/<sessionId>/state.json` and
   `step-1/parallel-1/request/request.json` exist on disk and `scripts/validate-request.mjs` is green
   on that branch. An agent that finds itself editing routed source, or publishing it, with no
   `step-N/parallel-M` under a session stops and reports `SESSION_MISSING`. Its repair is fixed, not a
   choice to surface: open the session now, move the already-written change onto the branch its git
   policy names for session work, and run the operators that owe the receipt for it — the same
   recovery `SESSION_MISSING` itself states — never write the session afterwards to make the past look
   gated, because that records the work instead of gating it. Designing by hand and committing on a
   session branch with no session on disk is the same violation as writing with no request: the
   candidates nobody saw, the screenshots nobody took and the UAT nobody ran are exactly what the
   missing folder was supposed to hold.
5. Select the first operator of that chain. Read only that operator's `operator.md` and
   `operator.json`.
6. Run that operator, end to end, on the one profile its `operator.json` names under `resources`, with
   only the grants it lists. An operator has no other model, no inherited turns, and no grant the
   assignment omits.

## Entry

| The request is about | First operator |
| --- | --- |
| Which project, checkout, or runtime binding applies | `workspace.bind` |
| What the product promises, who may have it, what happens when it fails | `business.decide` |
| System boundaries, data ownership, or the tech stack | `architecture.decide` |
| Server behaviour, an API contract, persistence, or a job | `backend.source.apply` |
| Creating, restructuring, or redesigning a page or surface | `frontend.direction.decide` |
| Which CSS value an already-composed tree takes | `frontend.presentation.resolve` |
| Writing an already-resolved tree into product source | `frontend.source.apply` |
| Whether a rendered surface actually holds up | `frontend.surface.audit` |
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
request/request.json -> validate-request.mjs -> agent writes response/ -> validate-response.mjs + the operator's validate.mjs -> route
```

Routing reads `response.json` and nothing else:

1. `done` advances the chain to the next step the workflow names; the next branch's `request.json`
   points at this branch's outputs by explicit path.
2. `waiting` runs the nested exchange the response awaits (`<exchange>/request` and `response` inside
   the same branch), then resumes the same agent; sibling branches keep running.
3. `blocked` reads `stop`, looks the code up in the merged registry (`operators/errors.json` plus the
   operator's own `errors.json`) for its `domain`, and resolves that domain in `routing.json`:
   - `operator` invokes the named operator, then returns here;
   - `resume` re-enters the same operator in a new step, `request.json.resume` naming the blocked one;
   - `user` stops and reports what the person must decide or publish;
   - `external` stops and reports what outside the runtime must change.
   A code whose disposition is `fallback` never blocks: the agent performs the fallback, records it
   under `## Fallbacks taken`, and continues, unless the code's `unless` param says otherwise.

A response that fails either validator does not route. Prose in `response.md` does not route. Only a
validated field of `response.json` does.

`routing.json` is closed and checked: every domain an operator's stop codes hand to has exactly one
route, and no route names a domain no code reaches. A missing route is a build failure, not a
judgement call.

## Progress

Every operator carries its own resume and fingerprint semantics, so this file holds no progress
counter and no handoff state. A `resume` route that returns `NO_PROGRESS` means the same input
reached the same wall: report the wall rather than trying again.

A cycle between two operators is valid only while the progress fingerprint changes. A repeated
fingerprint, or the same material finding twice, ends the loop and reports the smaller owner.

## Authority

This file grants nothing. Every authority boundary is enforced by the operator's own `operator.md`
tables and `validate.mjs`, which this file cannot widen:

- `git.publish` has no requirement that can name a force push, a bypassed hook, a reset, a clean, a
  stash, or a branch deletion; it merges the session branch, pushes non-force, and a conflict is
  `NON_FAST_FORWARD` for a person.
- `release.deploy`, `platform.operate` and `uat.verify` require an `approval`, taken from the
  environment's own declaration where it marks the touched operation class `declared` and from a
  person only where the environment marks it `person`; `release.deploy` runs only on a
  `quality-verification` input.
- `uat.verify`'s account record refuses a password field, and its validator rejects a
  credential-shaped string anywhere in what it writes.
- `frontend.presentation.resolve` and `frontend.surface.audit` may name only rule identifiers the bound
  knowledge publishes; `frontend.source.apply` writes only classes in the resolved inventory.
- A source-writing operator commits only on `session/<sessionId>`; the person's branch is never touched.

If a mission seems to need more than an operator allows, that is the answer, not an obstacle to route
around.

## Knowledge

Operators bind their own knowledge; this file does not preload it.

| Folder | Bound by |
| --- | --- |
| `knowledge/ui/composition/` | `frontend.direction.decide` |
| `knowledge/ui/presentation/` | `frontend.presentation.resolve` |
| `knowledge/ui/proof/` | `frontend.surface.audit` |
| `knowledge/patterns/fe/`, `knowledge/patterns/be/` | `frontend.source.apply`, `backend.source.apply` |
| `knowledge/grammars/<family>/` | every operator that composes that family |

English `.md` files are the only runtime authority. Same-stem `.vi.md` files are human mirrors and
never enter a context manifest, a dependency list, a validator input, or an operator binding.

## Orchestration

One invocation of one operator is one agent, created fresh on the profile its `operator.json` names,
with the aliases its Context table declares and the tools its `operator.json` declares (`@tools/<id>` from `resources/tools.json`, one mode each) and nothing else. `resources/orchestrator.json`
fixes the rules: at most three agents at once, branches of one step never sharing a write alias,
dispatch by workflow and `routing.json`, hand-off only through `response.json` fields inside the
session (`state.json`, `step-N/parallel-M/{request,response}`), a session the orchestrator creates
first and deletes after `git.publish`. An agent never starts another agent; a nested exchange (a
critique, a review) is a second fresh agent the orchestrator spawns for a branch that paused with
`waiting`. `alias/alias.json` is the one place an alias resolves to a location, and `alias/INDEX.md` is
its readable map by zone (workspaces, grammar, knowledge, worktrees, remote, dynamic); an operator
reads only what its Context table names.
