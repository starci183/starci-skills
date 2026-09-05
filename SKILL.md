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

Every user prompt first runs `scripts/session-open.mjs open`: it creates or reuses the one StarCi
ledger bound to the native Codex task or Claude session and its user worktree. This happens before
scope confirmation, planning, operator dispatch, helper dispatch, design or mutation. Agents, helpers,
nested exchanges and retries bind to that host session; none creates another user session.

1. Freeze one mission scope: the unit, the target, inclusions and exclusions, write roots, external
   effects, and what will count as proof. Two readings that would change any of those is one focused
   question, not a guess. Freezing is not silent: the already-open draft is printed as one table in
   the display language with Goal, Target, In scope, Out of scope, Outputs, Done when, Verification
   reach and Example, and its version is confirmed before step 2. If the prompt already stated and
   authorized exactly that table, record that prompt as `as-stated` instead of asking routinely.
   Correction creates the next draft version; rejection or silence leaves it non-executable. The scope
   line is the one place the narrowing is put
   to the person: it is filled from the counts of every plan this session has landed, at each plan
   transition (`state.json.mission.scope`, `resources/interaction.json#rule`), and what it says was deferred
   stands on the unchecked ledger under `@worktrees/unchecked` rather than in a second question. That
   block is the one question a new prompt asks; from then on the run is smooth:
   the transition log prints and never waits, a replan under the same goal and a routed re-entry ask
   nothing, and only a `user` route, a `budget-choice` or a corrected goal stops for the person
   (`resources/interaction.json#asks`). Each "done when" line names the
   operator whose receipt is that evidence, and a request from which no "done when" line can be
   written does not start. The table and the answer are recorded as `state.json.mission`
   and `choices["goal:<sessionId>:v<version>"]`: `corrected` writes the next version and asks again,
   and a mission whose latest version is not `as-stated` runs nothing
   (`scripts/validate-request.mjs`). A mission opened from an approved banked entry
   (`@worktrees/banked/<product>`, `state.json.mission.bankRef`) prints that block and does not wait:
   the person approved the whole queue once, and that one answer is the goal-confirm of every mission
   it lists, recorded as this session's own choice with the approval as its `sourceRef`
   (`scripts/validate-session.mjs#bankRefErrors`). A goal corrected at open time is not covered by it:
   the bank entry is rewritten, which ends the approval, and the next version is asked the same way.
   A follow-up within the confirmed goal asks nothing.
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
4. Activate the already-open session only when its latest mission version is explicitly confirmed.
   Plan the chain into that ledger. Before each invocation, write the v2.2 `request.json` with one
   versioned `expected`, its attempt identity and previous attempt, its exact environment and resource
   ownership, and every request-side artifact under `frozenInputs`. `scripts/attempt-gate.mjs open`
   semantically validates those sidecars, freezes the request and creates the running receipt. Then
   `scripts/worker-slots.mjs acquire <branch> <workerId> <ranProfile>` must grant one of the same
   session's three slots and record the actual dispatch profile before the operator runs. A missing
   session, unopened attempt or queued slot means no execution. A same-session Input is available
   only from a matched attempt whose accepted evidence manifest still seals the exact declared kind.
   A mission-owned helper first writes `templates/step/helper-request.schema.json`, then
   `worker-slots.mjs acquire-helper <session> <request.json> <workerId>` leases its concrete support
   write owners from those same three slots; the normal release command releases either worker kind.
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
| Serving a committed head on the product port, holding its lease | `runtime.serve` |
| Observability, a Sonar service, or a tunnel beside the served runtime | `service.operate` |
| Whether the served backend does what its own e2e suite says, as a client, on seeded data | `api.verify` |
| Applying a declared migration set once | `migration.release` |
| Whether what was delivered matches what was promised | `business.reconcile` |
| Shipping an image release, or recovering one | `release.deploy` |
| An educational content unit | `content.generate` |
| Publishing an approved Git boundary | `git.publish` |

A request that names no owner, or two owners whose scopes differ materially, stops here with one
focused question naming the competing boundaries.

A prompt that names a product's bank rather than an outcome — "run the bank for <product>" — is the
`bank` route (`routing.json#kinds.bank`, `resources/orchestrator.json#helpers.bank`), and it selects no
row of that table: the mission the row would have been chosen for is already written down. The
orchestrator takes `scripts/bank.mjs#next` — the first banked entry whose every `dependsOn` is done,
and nothing at all while a sibling of the same product is running — marks that entry
`running:<sessionId>`, opens the session at step 4 with `state.json.mission` copied from the entry's
goal draft and `mission.bankRef` naming the entry and the approval, and plans that session's chain from
its own done-when lines like any other mission. When the session ends `done` the entry is marked
`done:<sessionId>` and the next one is taken; a session that ended blocked or stopped leaves its entry
`running`, which is how a mission that stopped for the person pauses the bank instead of letting the
one behind it open. The orchestrator is the only writer of `queue.json` during a run, and
`scripts/validate-session.mjs#bankRefErrors` refuses a queue that reads the opposite of what happened.

Support work is not in that table, because it is not a mission. A request to prepare or tidy — to read
what a product left behind and draft a bank of missions from it, and whatever else the support layer
grows — is a `helper` route (`routing.json#kinds.helper`, `resources/orchestrator.json#helpers`): the
person writes `/helper <id> <args>` or names the job, the helper listed in
[`helpers/INDEX.md`](helpers/INDEX.md) runs on its own profile and leaves one run record under
`@worktrees/helpers/<id>/runs/<runId>/`. Its v2.2 receipt binds the existing host session and owning
StarCi session when there is one; it never opens another user session. A helper writes no product
source, touches no runtime, publishes nothing and asks nothing; one that finds it must do any of those
has found an operator's job.

## The loop

```text
attempt-gate open -> worker-slots acquire -> agent writes actual -> attempt-gate accept -> compare -> route | repair | retry | blocked
```

Routing reads `response.json` and nothing else:

1. `done` advances only when `comparison.verdict` is `matched`, every required expected criterion has
   one actual observation and resolvable evidence, and `comparison.next` is `advance`. It then follows
   the next step the dynamic plan names (`state.json.chain`, drawn by
   `scripts/plan-chain.mjs` and accepted by `scripts/validate-chain.mjs`); the next branch's
   `request.json` points at this branch's outputs by explicit path.
2. `mismatch` never advances. It preserves the request, response, actual evidence and comparison in
   `state.json.attempts`, then chooses repair, retry or blocked. The next attempt points at the previous
   id, keeps or strengthens required expected under the same goal version, and records what changed.
3. `waiting` releases its worker slot, runs the nested exchange as another attempt under the same
   session-wide cap, then reacquires a slot to resume; sibling branches keep running.
4. `blocked` reads `stop`, looks the code up in the merged registry (`operators/errors.json` plus the
   operator's own `errors.json`) for its `domain`, and resolves that domain in `routing.json`:
   - `operator` invokes the named operator, then returns here;
   - `resume` re-enters the same operator in a new step, `request.json.resume` naming the blocked one;
   - `chain` adds the target owner and prerequisites to this session's dynamic plan, preserving the
     host binding and confirmed goal; the blocked attempt waits without a slot and re-enters after
     the added branch produces accepted evidence;
   - `user` stops and reports what the person must decide or publish;
   - `external` stops and reports what outside the runtime must change.
   A code whose disposition is `fallback` never blocks: the agent performs the fallback, records it
   under `## Fallbacks taken`, and continues, unless the code's `unless` param says otherwise.

A response that fails the shared contract or operator validator does not route. Prose in `response.md`
does not route. Only a validated comparison and field of `response.json` does. The orchestrator writes `response.json` as a `running`
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

A cycle between two operators is valid only while the progress fingerprint changes. A retry that
reuses the same expected, inputs, environment revision and method after the same mismatch is
`NO_PROGRESS`; a repeated fingerprint ends the loop and reports the smaller owner. A
replan is a `replanned` transition carrying its note and the goal version it moves to. It runs without
another question inside the confirmed scope; a goal or scope change creates the next confirmation
version, never a silent rewrite.

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
  stash, or a branch deletion; it merges the session branch, pushes non-force, and
  a conflicting hunk the shared rule set does not cover is `NON_FAST_FORWARD` for a person.
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
rules: `scripts/worker-slots.mjs` permits at most three active workers across the whole host-bound
session, including nested exchanges, helpers and retries; normalized overlapping resources queue;
an attempt with writes leases its concrete owner, and source-writing work automatically leases the
real worktree after junction/symlink and Windows-case normalization; branches run only with accepted inputs and isolated environment ownership; dispatch follows
the planned chain and `routing.json`, hand-off only through `response.json` fields inside the session
(`state.json`, `step-N/parallel-M/{request,response}`). Publication does not close a session. Only an
explicit close-success event may compact and verify its durable bundle under `@worktrees/done` before
deleting exactly that session folder; blocked and failed sessions remain resumable, and no user
worktree or branch is deleted. An agent never starts another agent; a nested exchange (a critique, a
review) is a second new agent, in the operator's own mode, that the orchestrator spawns for a branch
that paused with `waiting`. Every file an agent writes under `response/` is swept for
secret-shaped values by the response gate (`scripts/sweep-secrets.mjs`) before the branch can route. `alias/alias.json` is the one place an alias resolves to a location, and `alias/INDEX.md` is
its readable map by zone (workspaces, grammar, knowledge, worktrees, remote, dynamic); an operator
reads only what its Context table names.
