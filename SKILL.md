---
name: starci
description: Complete one StarCi mission by freezing its scope, selecting the one operator that owns the outcome, and routing between operators on typed results until the outcome is proved or a person must decide.
---

# StarCi

One entry, the operators listed in their index, one closed routing map, one tool registry. This file plans
the chain from the confirmed mission, selects the first operator, and sequences the rest. It does no work of its own: it never decides a value, writes source, or judges a
result.

## Setup

Before communicating a question, apply [the interaction policy](resources/interaction.md).
This changes communication only: all routing transitions, operator boundaries and required
authorizations below remain in force. An Ask column or diagnostic reason is not a prompt to forward.

1. Freeze one mission scope: the unit, the target, inclusions and exclusions, write roots, external
   effects, and what will count as proof. Two readings that would change any of those is one focused
   question, not a guess. Freezing is not silent: for a mission that will write routed source or touch
   a runtime, the frozen scope is printed to the person as one block of at most four lines in their
   language — the goal, what is in and what is out, the "done when" lines, one question — and
   confirmed once through a `goal-confirm` choice before step 2. Each "done when" line names the
   operator whose receipt is that evidence, and a request from which no "done when" line can be
   written does not start. The block and the answer are what step 4 records as `state.json.mission`
   and `choices["goal:<sessionId>:v<version>"]`: `corrected` writes the next version and asks again,
   and a mission whose latest version is not `as-stated` runs nothing
   (`scripts/validate-request.mjs`). Read-only work asks nothing.
2. Run `environment.preflight` first for any mission that touches routed source or a runtime: every
   wall the mission could meet — an undeclared or near-named route, a missing git policy, a dirty
   checkout, a sign-in that fails, a served head that does not contain the bound one, a held port, a
   missing browser or container, an approval the environment keeps with a person — is reported at
   once, as one typed readiness report, rather than one per hour as the chain runs into them. Then
   run `workspace.bind` for any mission that reads or writes routed source. Nothing else may resolve
   a checkout, and a similar directory name is never route authority.
3. Plan the chain from the confirmed mission, never from an example: there is no `when` to look up.
   `scripts/plan-chain.mjs` walks backwards from the operators the "done when" lines name through
   the operators' Inputs, Context and Next tables (`workflows/README.md` states the derivation and
   the rules), opens the chain with `environment.preflight` whenever an operator in it holds an
   effect tool, binds every role the mission declares or a Context table requires, runs an operator
   that more than one "done when" line names after its `<domain>.plan` sibling so the execute step
   fans out by units — one unit per branch, at most three branches per step — and applies the
   long-flow law: a chain that writes frontend source
   under `mode: apply` and reaches `git.publish` proves the surface with the audit whose primary
   output is `frontend-surface-audit` and walks it with `uat.verify` in between, because a delivery
   nobody looked at and nobody walked through is not a delivery. The plan is printed to the person as
   two lines per branch — the goal, then why the branch is there — and `scripts/validate-chain.mjs`
   accepts it before step 5; a chain the tables leave ambiguous is a refusal naming the ambiguity,
   never a guess. Every stop that changes what the mission needs redraws the chain the same way and
   records it as a `replanned` transition with its note and goal version.
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
   only the grants it lists. An operator has no other model, no inherited turn beyond what its
   `resources.mode` and the profile's `forkTurns` allow, and no grant the assignment omits.

Cross-session evidence uses scripts/producer-import.mjs. Copy a completed producer request/response bundle into an unused receiving step-N/parallel-M coordinate, preserving every byte and original session/step metadata. import.json binds the source and target coordinates and every file digest. The input gate verifies the original frozen request, its declared completed outputs, origin and copied bytes; imported slots are evidence only and never enter the receiving chain, steps, request hashes or leases. Use the normal step-N/parallel-M/response input path. No operator is rerun, and no source-write authority is imported. The kinds an imported slot declares count as already produced for the chain, in the plan and at the gate (`workflows/README.md`, How a chain is derived).

## Entry

| The request is about | First operator |
| --- | --- |
| Whether this machine, its routes, identities, runtimes and approvals are ready for the mission | `environment.preflight` |
| Which project, checkout, or runtime binding applies | `workspace.bind` |
| What the product promises, who may have it, what happens when it fails | `business.decide` |
| System boundaries, data ownership, or the tech stack | `architecture.decide` |
| Server behaviour, an API contract, persistence, or a job | `backend.generate` |
| Naming every page and modal a feature needs before any of them is generated | `interface.plan` |
| Creating, restructuring, or redesigning one page or one modal | `interface.generate` |
| One small finding on a page that exists: under three files, no layout change | `interface.fix` |
| Repairing an owner library package and consuming its release through exact dependency metadata | `workspace.bind`, then `library.update` |
| Whether a rendered surface actually holds up | `interface.audit` |
| Build, lint, typecheck, coverage, or Sonar | `quality.verify` |
| Naming one flow per journey a feature must be walked through | `uat.plan` |
| Whether a real person can complete a real journey | `uat.verify` |
| An account a flow signs in as | `identity.provision` |
| The rows a flow needs, attributable and reversible | `data.seed` |
| Serving a committed head on the product port, holding its lease, or a tunnel to it | `runtime.serve` |
| Applying a declared migration set once | `migration.release` |
| Whether what was delivered matches what was promised | `business.reconcile` |
| Shipping an image release, or recovering one | `release.deploy` |
| An educational content unit | `content.generate` |
| Publishing an approved Git boundary | `git.publish` |

A request that names no owner, or two owners whose scopes differ materially, stops here with one
focused question naming the competing boundaries.

## The loop

```text
request/request.json -> validate-request.mjs -> agent writes response/ -> validate-response.mjs + the operator's validate.mjs -> route
```

Routing reads `response.json` and nothing else:

1. `done` advances the chain to the next step the plan names (`state.json.chain`, drawn by
   `scripts/plan-chain.mjs` and accepted by `scripts/validate-chain.mjs`); the next branch's
   `request.json` points at this branch's outputs by explicit path.
2. `waiting` runs the nested exchange the response awaits (`<exchange>/request` and `response` inside
   the same branch), then resumes the same agent; sibling branches keep running.
3. `blocked` reads `stop`, looks the code up in the merged registry (`operators/errors.json` plus the
   operator's own `errors.json`) for its `domain`, and resolves that domain in `routing.json`:
   - `operator` invokes the named operator, then returns here;
   - `resume` re-enters the same operator in a new step, `request.json.resume` naming the blocked one;
   - `chain` opens a sibling session for the outcome the route's target names, its chain planned from
     that mission like any other, the blocked branch waiting on that session's end and re-entering
     with what it produced — an owner library defect is repaired and consumed this way, and a person
     is asked nothing;
   - `user` stops and reports what the person must decide or publish;
   - `external` stops and reports what outside the runtime must change.
   A code whose disposition is `fallback` never blocks: the agent performs the fallback, records it
   under `## Fallbacks taken`, and continues, unless the code's `unless` param says otherwise.

A response that fails either validator does not route. Prose in `response.md` does not route. Only a
validated field of `response.json` does. The orchestrator writes `response.json` as a `running`
skeleton at dispatch; an agent that exits without replacing it is followed up once and then recorded
as `RECEIPT_MISSING`, so a branch that narrated its work and wrote no receipt is visible in the ledger
instead of silently passed.

`routing.json` is closed and checked: every domain an operator's stop codes hand to has exactly one
route, and no route names a domain no code reaches. A missing route is a build failure, not a
judgement call.

## Progress

Every operator carries its own resume and fingerprint semantics, so this file holds no progress
counter and no handoff state. A `resume` route that returns `NO_PROGRESS` means the same input
reached the same wall: report the wall rather than trying again.

A cycle between two operators is valid only while the progress fingerprint changes. A repeated
fingerprint, or the same material finding twice, ends the loop and reports the smaller owner. A
replan is a `replanned` transition carrying its note and the goal version it moves to, confirmed again
through `goal-confirm`, never a silent rewrite of the chain.

The session runs under a budget (`state.json.budget`, from `resources/orchestrator.json#budget`): a
step cap and a same-operator cap. A request that would pass either is `BUDGET_EXHAUSTED`, and the
person answers one typed `budget-choice` — narrow, continue, stop — recorded in `state.json.choices`;
continue extends the cap on record. The orchestrator's own memory is `state.json.brief` — what is
proven, what is blocked and on whom, what is next, which peer session owns which head, and the last
report the person received — rewritten after every transition and read back after a compaction; no
note file beside it is recognised. `scripts/validate-session.mjs` checks the whole ledger after every
transition.

On a mission, every branch names its goal before it runs: `request.json.goal` points at exactly one
`state.json.mission.doneWhen` line whose `producedBy` is the branch's operator, or declares the branch
it is a `prerequisite` of, and `scripts/validate-request.mjs#branchGoalErrors` refuses a branch that
points at nothing. The receipt answers that goal: a done branch that serves a done-when line carries
`response.json.goalCheck` — `achieved`, and the declared response files that are its `evidence` — and
`scripts/validate-response.mjs#goalCheckErrors` accepts it only when every evidence path is an output
the receipt declares and exists on disk, with at least one behind `achieved: true`. Only a
validator-accepted goalCheck reaches `brief.proven`, as `doneWhen:<n> …`; three consecutive done
branches that evidenced no done-when line stop the chain and the person is asked, never a fourth
branch dispatched (`scripts/validate-session.mjs`). After every transition the orchestrator prints to
the root chat exactly the two lines `resources/interaction.json#transitionLog` declares — the branch
goal, then its outcome with the count of evidenced done-when lines, the artifact paths and the next
cell — and records `logged: true` on the transition; full outputs stay in the session folder.

A rule a person states in their own words is restated to them before anything is designed on it:
`business.decide` and `architecture.decide` write a `restatement` of at most five lines in the
person's language and stop with `RESTATEMENT_UNCONFIRMED` until the person selects `as-stated` or
`corrected` on a `restatement-confirm` choice; a corrected reading arrives as the corrected
requirement and the same branch runs again. Every turn the orchestrator ends with a person is one of
the report shapes `resources/interaction.json` declares — delivered, blocked on you, working — in the
person's language; a hand-off to a peer session is a waiting branch with a wake condition, never the
end of a turn.

## Authority

This file grants nothing. Every authority boundary is enforced by the operator's own `operator.md`
tables and `validate.mjs`, which this file cannot widen:

- `git.publish` has no requirement that can name a force push, a bypassed hook, a reset, a clean, a
  stash, or a branch deletion; it merges the session branch, pushes non-force, and a conflict is
  `NON_FAST_FORWARD` for a person.
- `release.deploy`, `migration.release`, `runtime.serve` and `uat.verify` require an `approval`, taken from the
  environment's own declaration where it marks the touched operation class `declared` and from a
  person only where the environment marks it `person`; `release.deploy` runs only on a
  `quality-verification` input.
- `uat.verify`'s account record refuses a password field, and its validator rejects a
  credential-shaped string anywhere in what it writes.
- `interface.generate` and `interface.audit` may name only rule identifiers the bound knowledge
  publishes; `interface.generate` and `interface.fix` write only classes in the resolved inventory.
- A source-writing operator commits only on `session/<sessionId>`; the person's branch is never touched.

If a mission seems to need more than an operator allows, that is the answer, not an obstacle to route
around.

## Knowledge

Operators bind their own knowledge; this file does not preload it.

| Folder | Bound by |
| --- | --- |
| `knowledge/ui/composition/` | `interface.plan`, `interface.generate` |
| `knowledge/ui/presentation/` | `interface.generate` |
| `knowledge/ui/proof/` | `interface.audit` |
| `knowledge/patterns/fe/`, `knowledge/patterns/be/` | `interface.generate`, `interface.fix`, `backend.generate` |
| `knowledge/grammars/<family>/` | every operator that composes that family |

English `.md` files are the only runtime authority. Same-stem `.vi.md` files are human mirrors and
never enter a context manifest, a dependency list, a validator input, or an operator binding.

## Orchestration

One invocation of one operator is one run, in the mode its `operator.json` declares under
`resources.mode` (`resources/orchestrator.json#modes`): `inline`, where the orchestrator performs the
operator's Steps itself in the chat as a checklist under the operator's own validators (a route
binding, a gate run, a publication); `dispatch`, where one new agent inherits the orchestrator's
transcript for the turns its profile's `forkTurns` allows, at most one such agent at a time
(`#concurrency.maxDispatch`); or `isolated`, where one new agent starts with an empty context and sees
only the generated `operators/<id>/brief.md`, its `request.json` and the files its `inputs` and
`contexts` name, in its own worktree and browser profile. A dispatched or isolated agent runs on the
profile the operator names, with the aliases its Context table declares and the tools its
`operator.json` declares (`@tools/<id>` from `resources/tools.json`, one mode each) and nothing else,
and is awaited on its completion event, never on a timer. `resources/orchestrator.json` fixes the
rules: at most three agents at once, branches of one step never sharing a write alias, dispatch by
the planned chain and `routing.json`, hand-off only through `response.json` fields inside the session
(`state.json`, `step-N/parallel-M/{request,response}`), a session the orchestrator creates first and
deletes after `git.publish`. An agent never starts another agent; a nested exchange (a critique, a
review) is a second new agent, in the operator's own mode, that the orchestrator spawns for a branch
that paused with `waiting`. Every file an agent writes under `response/` is swept for
secret-shaped values by the response gate (`scripts/sweep-secrets.mjs`) before the branch can route. `alias/alias.json` is the one place an alias resolves to a location, and `alias/INDEX.md` is
its readable map by zone (workspaces, grammar, knowledge, worktrees, remote, dynamic); an operator
reads only what its Context table names.
