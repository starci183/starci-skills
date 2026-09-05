# Workflows

There are no workflow files. A chain is never chosen from an example: it is derived from the
mission, by `scripts/plan-chain.mjs`, from the operator tables alone, and it is checked by
`scripts/validate-chain.mjs` every time it is drawn. The example chains this folder used to hold are
planner fixtures now, under `tests/chains/`, and `scripts/plan-chain.spec.mjs` proves the planner
still derives each of them from the outcome its mission names.

## Executable v2.2 lifecycle

The first prompt opens or reuses the host-bound draft with `scripts/session-open.mjs` before scope
confirmation. Confirmation activates one version. The planner remains the only chain owner: it derives
steps from that confirmed goal, and a replan inside the scope changes the chain without rewriting the
goal or asking per operator.

Every planned invocation becomes a versioned attempt. Its request freezes `expected.criteria`, the
exact `environment` and resource ownership, and request-side `frozenInputs` before
`scripts/attempt-gate.mjs open`. `scripts/worker-slots.mjs` then grants one of at most three active
slots shared by top-level branches, nested exchanges, helpers, repairs and retries. Missing inputs,
overlapping exclusive paths/resources and the fourth ready worker queue. A writing attempt leases a
concrete owner; source-writing work automatically leases the real workspace even through a junction,
symlink or Windows case alias. Waiting releases its slot.
`attempt-gate accept` runs the full shared and operator gates, resolves actual evidence and compares
every criterion. Only a matched receipt advances. Mismatch is preserved and leads to repair, retry or
blocked; a retry points to it and cannot weaken required expected under the same goal version.

## How a chain is derived

The planner starts from the confirmed mission (`state.json.mission`): every "done when" line names
the operator whose receipt is that evidence, and those operators are the targets. It walks backwards
through the tables every operator publishes in its `operator.md`:

- a required **Input** pulls in the operator that produces that kind — a producer already in the
  chain first, else the one operator whose `primaryOutput` is that kind (two primaries are settled
  by the operator the Inputs row names), else the only producer; a kind the tables leave ambiguous
  is a refusal that names the candidates, never a guess; and when the chain already holds several
  branches of one operator, the mission's own order of "done when" lines settles which of them a
  consumer reads — the branches whose lines come before its own, never a later one, because a later
  branch of the same operator is another route, another finding or a later head;
- a required Input whose kind an **imported slot** of the session already carries
  (`scripts/producer-import.mjs`: an evidence-only coordinate holding `import.json` beside a copied
  producer bundle) is already produced when no branch of the chain produces it: no producer is
  added, the consuming branch binds the slot's output as `inputs.<kind>`, and the preview prints
  `<kind> imported from <sourceSession> step N`; a slot without `import.json` is a local input, a
  slot whose origin operator this tree cannot name declares nothing, and at the gate the kind is
  credited only when `validate-request#validateImportedInput` accepts the reference — the plan
  learns that the kind exists, the import gate stays the authority on the bytes;
- a required `@workspaces/<role>` **Context** row pulls in a `workspace.bind` of that role, and a
  role the mission declares is bound before every working branch even when no table asks for it;
- an operator that more than one "done when" line names, when its domain has a `<domain>.plan`
  operator, runs after that plan and **fans out by units**: one unit per branch, the branch naming
  its `unit` (the threshold and the unit's validity are `validate-request`'s, `#unitGateErrors`);
  one line needs no map;
- any operator holding an effect tool (the same predicate the mission gate reads from
  `operator.json`) opens the chain with `environment.preflight`;
- a mission that names `git.publish` while a branch writes frontend source under `mode: apply` owes
  the audit and the walk in between — the long-flow law, stated in kinds: the operator whose primary
  output is `frontend-surface-audit`, then `uat.verify`, before the publish;
- a `chain` route adds the target owner and its prerequisites to this host-bound session's plan. The
  blocked attempt waits without a slot, then re-enters from the accepted output. It never opens a
  sibling user session or gains a second concurrency allowance.

Two ties the required inputs leave open are settled by the tables too: an optional Input orders its
consumer after a producer already in the chain, and a one-way Next row orders the operator that
hands over before the one it hands to — each unless it would close a cycle, in which case the hard
edges win and the dropped edge is on record in the plan. The nodes are then packed into steps:
a branch runs only when everything it depends on ran in an earlier step and a Next table of the step
before names it; at most three branches per step (`resources/orchestrator.json#maxConcurrentAgents`,
or `#concurrency.maxParallel` when declared); never two writers of one alias in one step; a fan-out
branch alone in its step so its units can expand in place; and a publish or a deploy only once every
branch still unplaced is itself a boundary, so a mission that publishes two routes ends with both,
one after the other. Every branch gets a goal — the done-when
line it evidences, or the earliest later branch it enables — which is what `request.json.goal`
carries and `validate-request` checks.

The plan fixes a branch's requirements before its request exists — a bind's `role`, the preflight's
`roles`, a preset `mode` — and the orchestrator writes them as `state.json.planned["N/M"].requirements`
when the chain is drawn or redrawn, before the first dispatch. The gate reads a bind's role from the
request when it is written, else from the plan, so a chain drawn before step 1 validates; the
request that later dispatches a planned branch carries the planned values unchanged, or
`validate-request#plannedRequirementErrors` refuses it, because the chain was validated on those
values and a request that changed one runs a branch the chain was never checked for.

The plan is printed to the person as two lines per branch (the goal, then why the branch is there)
before anything is dispatched, and `node scripts/plan-chain.mjs <session>` prints the same preview
and the JSON block for a session on disk.

## What the gate enforces

`validate-chain` reads `state.json.chain`, `state.json.steps`, `state.json.planned` and each branch's
`request.json`, and refuses a chain in which:

- a branch names an operator the tree does not carry, or a cell sits in a step its number does not
  name, or the plan fixed requirements for a cell the chain does not name;
- a step holds an operator that no Next table of the step before permits and that is not a re-entry
  of the same operator;
- a branch requires an Input no earlier step produces and no accepted imported slot its request
  names supplies, or a `@workspaces/<role>` context no earlier `workspace.bind` of that role bound
  or is planned to bind (both as derived above);
- a branch's written request differs from the requirements the plan fixed for it;
- a step holds more than the parallel cap, or two branches of one step write the same alias;
- a branch writes frontend source under `mode: apply` and `git.publish` follows with the audit or
  `uat.verify` missing or outside the write and the publish;
- `git.publish` or `release.deploy` runs and something other than a publish or a deploy runs after
  it — a chain ends at `git.publish`, `release.deploy` or a person;
- on a mission, a branch names no goal, cites a done-when line its operator does not produce, or a
  prerequisite that is not a later branch of the chain;
- the chain holds a `<domain>.plan` and a branch executing its units runs in the same or an earlier
  step; which unit the branch names, and that the plan listed it, is `validate-request#unitGateErrors`.

`validate-session` runs it on the whole ledger after every transition.

## Replanning

A chain is drawn once, before the first dispatch, and again on every stop that changes what the
mission needs: a `blocked` branch whose route re-enters or adds an operator, a plan whose units are
known, a corrected goal. Each redraw is a `replanned` transition in `state.json.transitions`
carrying its note and the goal version it runs under: the current version when only the chain
changed (a red gate routed back to its owner, a plan produced its units, a stop added an operator),
and the next version — confirmed through `goal-confirm` like the first plan — when the goal itself
was corrected; never a silent rewrite (`scripts/validate-session.mjs#missionHistoryErrors`).

Goal achieved, operator done and publish success are not a user-session close. An explicit
close-success event first writes and verifies the compact and durable bundle under
`@worktrees/done/<sessionId>`, then removes only the matching temporary session folder. Blocked,
failed and waiting ledgers stay in place for resume; user worktrees and branches are outside cleanup.

## The fixtures

`tests/chains/<id>.json` holds the eleven 2.0.0 example chains rewritten to the current operator
ids, each with the mission whose done-when lines name its outcomes, the operator order it expects,
and a note on how it was rewritten. They are inputs to the planner's spec, not to the runtime: the
entry never reads them.
