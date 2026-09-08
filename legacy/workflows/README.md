# Workflows

There are no fixed workflow chain files. A chain is never chosen from an example: it is derived from the
mission, by `scripts/plan-chain.mjs`, from discovered delivery impacts and the operator tables, and it is checked by
`scripts/validate-chain.mjs` every time it is drawn. The example chains this folder used to hold are
planner fixtures now, under `scripts/fixtures/chains/`, and `scripts/plan-chain.spec.mjs` proves the planner
still derives each of them from the outcome its mission names.

User topology is selected above this chain by `resources/orchestrator.json#workflowTopologies`;
this folder defines no second topology or peer semantics.

## Executable workflow lifecycle

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
For a local Input, existence is insufficient: `validate-request` resolves the producing cell, requires
its attempt to be matched, verifies its accepted evidence manifest against the current request and
response inventory, and checks that `response.fields[<kind>]` emitted that exact ref. An explicit
cross-session import remains governed by its import manifest. A mission-owned helper writes a
`templates/step/helper-request.schema.json` dispatch request under its run directory;
`scripts/worker-slots.mjs acquire-helper` verifies its host-session binding and concrete `.worktrees`
write owners before it enters the same cap, and the common release command frees its slot.
`attempt-gate accept` runs the full shared and operator gates, resolves actual evidence and compares
every criterion, then seals the exact request/response file inventory in the attempt's
`evidenceManifest`. Only a matched receipt advances. Mismatch is preserved and leads to repair, retry or
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

`scripts/fixtures/chains/<id>.json` holds the 2.0.0 example chains rewritten to the current operator
ids, each with the mission whose done-when lines name its outcomes, the operator order it expects,
and a note on how it was rewritten. They are inputs to the planner's spec, not to the runtime: the
entry never reads them.

Goal discovery, handoff scope and project workflow ownership follow [discovery.md](discovery.md).

## Immutable forecast revisions

The planner owns one forecast history. Confirmation retains the exact mission and user answer under
`runtime/history/missions/`; opening an attempt retains its mission, choices and forecast context under
`runtime/history/invocations/`. State contains their content addresses. Acceptance resolves the context
that invocation froze; a later goal or answer cannot reinterpret its proof. Current completion counts
only current mission evidence, never an older done-when index with the same number.

Use `node scripts/plan-history.mjs preview <session> [flags.json]` to derive and display the complete
mission forecast with its dependency and handoff lanes. It is labelled planned, not executed or
verified. Then pass the returned `previewHash`, unchanged `flags` and a concrete `reason` to
`node scripts/plan-history.mjs commit <session> <reviewed-plan.json>`. A changed scope, attempt or plan
makes the preview stale. The owning lock refuses running invocations, active leases and waiting obligations not resolved by the exact review re-entry below.

A forecast describes logical work; only dispatch freezes its concrete invocation. A revision may
reassign a future coordinate that has no request directory or attempt. Dispatched coordinates and
all existing branch files remain reserved, unchanged and sealed by the revision inventory. The
logical node map records supersession, never execution. Original request prerequisites remain in
their invocation context; the current map identifies the future consumer without pretending the
original physical coordinate was fulfilled. Missing historical context is unavailable for proof
reuse, never reconstructed from prose or retired execution. A still-running current-version attempt
without a context may retain one only during successful acceptance, explicitly marked `acceptance`.

For the same confirmed goal, retain the current forecast and use `flags.edit` in the preview:

- `{"kind":"retry","cell":"N/M"}` preserves an accepted mismatch or inconclusive attempt and
  schedules its unique same-goal successor. The new request keeps the operator, requirements,
  inputs, unit and effect bounds, names `attempt.previous`, and changes verified input, method or
  checkout revision. Renumbering expected or an attempt is not progress. An optional
  `rebind: {source: "P/Q", writeRoots: [...]}` inserts the exact earlier session checkout binding
  before the retry. Additional roots must fit the failed request's mutable ownership and exclude
  protected ownership; current route, dirty paths and source authority are checked again. The retry
  waits for matched acceptance of that exact new binding. Historical binds verify their original
  request, invocation and complete evidence seals rather than observing later dirt as old input.
  A blocked `INVALID_INPUT` has no general retry route. `correction: "source-history"` with
  `revision` equal to the measured current HEAD may reopen a source window whose retained changes
  binding and readable reflog prove the rejected operation. It freezes that HEAD as a fresh base;
  the old window supplies no implementation credit. Unanswered interactions and other caller or
  external stops keep their owning gates. The new source receipt still passes every source-write
  and expected/actual requirement, including its own commit policy.
  `correction: "source-proof-review"` instead names a `criterionId` that was required and remained
  nonpassing in the sealed observation and comparison over declared changes evidence. Its readable
  source window must contain exactly one normal commit whose retained end is an ancestor of the
  fresh actual HEAD named by `revision`. Intervening work supplies no proof for this failed outcome. The
  `methodRef` names a canonical artifact under the new request's `request/` directory; that request
  freezes its actual bytes in `frozenInputs`, with content different from every original frozen
  input. Moving the base or renaming unchanged method bytes is insufficient. The new invocation
  retains the same goal, unit, inputs, requirements, effects and required criteria, then produces
  its own correction commit and complete source proof. Neither the retained blocked commit nor
  the review selection earns implementation credit or bypasses an unanswered interaction.
- `{"kind":"resume","cell":"N/M"}` re-enters an accepted blocked node. Restatements require their
  exact recorded user answer; other stops must route to that operator's resume. An optional `source`
  names an accepted current-version blocked reading for an unopened node with the same operator and
  logical goal. The resulting request names the returned resume target and actual choice.
- `{"kind":"expand","cell":"N/M","producer":"P/Q"}` expands an unopened fanout from its actual
  matched plan's sealed `units` output, preserving already executed nodes. Unit dependencies run
  first. When the operator owns several done-when lines, `goals` maps each unit id to its confirmed
  line index. The resulting request binds the returned unit id and exact `inputs.units` reference.
  `scripts/plan-history.mjs#acceptedUnitDependency` resolves a retained dependency through its unique
  sealed retry lineage. Every link retains the operator, logical unit and accepted plan input, with
  its original invocation forecast authority. Only the latest matched proof can satisfy current
  consumption; pending, failed, ambiguous or altered successors cannot fall back to older credit.
  The current producer-delivery gate still rejects disputed or retired source. Historical plans and
  receipts remain unchanged; new retry forecasts update the unopened unit edges.
- `{"kind":"repair","cell":"N/M","wall":"runtime.<role>.head","requirements":{...}}` follows
  an accepted current preflight's declared runtime Next for its sole runtime-head wall. Requirements
  bind that project's role, environment, frozen commit and current environment approval, with only
  `attest-runtime-entry` effects. The edit inserts a separate attestation and then the complete
  same-requirements preflight re-entry. The re-entry opens only after the repair has a matched,
  sealed reused-head receipt without integration changes. A failed or unproved repair stays blocked.
  This prerequisite attestation grants no source write or future delivery credit; the original
  delivery runtime node, dispatched coordinates and independent planned peers remain in the forecast.

For an unopened runtime delivery goal, `{"kind":"partition","cell":"N/M","env":"<environment>","routes":["<project>/<role>"]}`
records its complete goal-specific route mapping and schedules one single-route invocation per member.
The mapping names only exact repository routes from the confirmed discovery. A mission with several
repositories explicitly maps each runtime delivery goal before dispatch; a goal naming one route does
not acquire every repository. The existing goal and scope remain unchanged. Each invocation freezes
its route, environment and target commit, binds that commit as its source-role context head, and binds
its accepted source changes when it consumes them. Runtime repairs that merely enable another branch
do not earn delivery partition credit.

The active forecast passes Input, Context, Next, goal, long-flow and finite budget gates. A declared
dependency handoff can continue from an earlier input or context owner whose authored Next names
the consumer; it cannot search unrelated history. The preview records that edge. Dispatch requires
the owner to have matched current-version, validator-accepted sealed evidence and the invocation
to consume that actual output. An ordinary unsealed chain keeps immediate Next validation.

A material goal correction uses `session-open.mjs confirm` with `corrected`, followed by the actual
confirmation of its new version. Its complete new forecast retains prior execution as historical
evidence that cannot dispatch, feed current inputs or close the new goal. The old inventory and
answers remain checked. No arbitrary step boundary exempts history from its immutable commitments.

A waiting node whose exact sealed nested review selects its kind contract's `reentry` verdict uses the same `resume` edit. The forecast retains the parent/child attempt identities, request hashes, evidence fingerprints and current scope. It opens a new same-owner invocation; neither accepted checkpoint is resumed or rewritten in place. The replacement must produce its own model and receive its own fresh matched nested review before it can conclude. A planned replacement remains an outstanding obligation and supplies no completion evidence.

When the owning execution discloses a review-integrity concern, add `integrity: {ref, hash}` to that edit. The session-relative JSON disclosure has exactly `version: 1`, `identity`, `disposition: "fresh-review-required"`, a concrete `reason`, and the actual admission's `sourceRef`. Its identity binds `sessionId`, `missionVersion`, `scopeHash`, and `parent`/`child` records containing `cell`, `attemptId`, `requestHash`, and `evidenceFingerprint`. The hash covers the exact disclosure bytes, retained in the sealed forecast. This record authorizes only fresh review within the existing confirmed scope: it is neither a review verdict nor an approval or delivery input. Preserve the questioned evidence and its admitted limitation; no filesystem timestamp substitutes for execution provenance.


## Review accepted source

An accepted source receipt remains immutable when a later check questions its implementation. Use
the existing forecast edit with `kind: "review"`, the source `cell`, an original required
`criterionId`, the new request-side `method: {ref, sha256}`, the actual `gates` plan, and any exact
accepted source `counterparts`. This schedules a read-only `quality.verify` invocation against the
bound source. The diagnostic measures the source criterion; API or browser output alone does not
establish that a different source owner must change. A source-only review claims no runtime or
unmeasured interface verdict.

A matched review whose sealed required gate actually failed in-boundary, without debt, permits
`kind: "source-repair"` with the original source `cell`, its `review` cell and exact `gateRef`.
The fresh invocation keeps the source owner, unit, requirements, required expected criteria and
effect boundaries. It consumes the changed frozen verification method, preserves source ancestry
and produces its own normal source commit and proof. The original accepted request, response and
commit are retained. When repairing an already accepted source consumer, `replacements` maps only
its original input kind to the exact accepted producer repair that its own review measured as a
counterpart; it grants no unrelated input or write authority.

`scripts/source-review.mjs` owns the review relationship and current same-session consumer barrier.
The complete-goal reader below uses its pending and retired-source result. Expected pending review
is a valid outstanding obligation, not an invalid session; only affected goals and dependent
consumers wait. A verified red review prevents the old source from earning delivery credit again,
including after its replacement succeeds. A green exact review preserves the original source
credit. Producer-import and coordination also check this current delivery barrier before creating
an import, opening a fresh imported-input consumer, resolving a producer or incorporating its source.
Pending or retired source cannot become new delivery evidence. Historical accepted imports and
invocations retain their original sealed proof; the barrier does not rewrite those receipts.

## Complete goal evidence

A sealed forecast records one closed obligation set for each declared route partition or accepted
unit plan. Its immutable members retain the original goal index and their exact route declaration or
accepted plan output, request hash and evidence fingerprint. A same-goal replan preserves every
required member. Retried or resumed invocations keep their member identity; their original receipts
and invocation contexts remain unchanged. An existing sealed single-route preset already supplies
that goal-specific mapping. An existing unit forecast derives the same complete set from its accepted
producer, including required units whose execute requests have not been written.

For a partitioned branch, response.goalCheck describes only its own member. Partial accepted evidence
is progress, so it does not trigger the consecutive-no-progress stop. The original done-when line is
proven only when every required current member has independently matched, its complete declared
evidence and request remain sealed, and its own validator still accepts that proof. A plan, an unopened
cell, a duplicate member, a different unit producer, a runtime prerequisite repair, a stale mission or
a mismatched result cannot substitute. Verification uses the journey tier from scripts/unchecked.mjs;
secondary units remain unchecked and do not replace required journey evidence. Generation retains
every planned unit.

Scripts/goal-partitions.mjs owns this aggregation. The goal ledger, brief.proven gate, session terminal
gate, dependent invocation admission and coordinator original-proof reader consume the same result.
A consumer waiting on the complete obligation opens only after all its required members are accepted.
The coordinator retains every required proving branch and checks each partition's repository bindings;
it never constructs one multi-role observation from unrelated partial runs.

## Extract shared work during execution

The ownership authority is `resources/orchestrator.json#workflowTopologies.coordination`; `scripts/workflow-coordination.mjs` executes it. Its commands take `<command> <own-session> <input.json>`. Each peer calls `enrol` with the coordinator session id. The coordinator calls `assign` with disjoint repository-relative claims, then `prepare` with an exact donor impact subset, untouched producer draft, producing operator and unopened dependent consumer coordinates. The new producer self-enrols using the returned preparation address; `activate` atomically transfers the selected roots. A broad original root may retain canonical exclusions for transferred subtrees. Only overlapping active write reservations delay transfer; independent sibling work keeps its original authority. Current scope changes invalidate an unactivated preparation.

Claims are literal repository paths. Generalized discovery descriptions and evidence annotations do not grant filesystem writes. The same ownership helper can derive a literal claim from an intact same-mission accepted source file, or from an original admitted source request joined to its accepted workspace binding and exact current write boundaries. Backend requests retain their mutable/protected matcher; frontend requests retain their explicit write set and exclusive boundary. Thus a new shared file need not be implemented by its donor first. Initial assignment also seals the identities of source invocations already in flight. Those exact invocations may finish with unchanged request/context bytes while current ownership and dependency gates still hold; the retained identity cannot admit a new invocation.

After the new producer's ordinary current attempt is accepted, the coordinator calls `resolve` with the dependency id and exact producer step/parallel. Each consumer uses the existing producer-import command to retain that typed input. For source output it then calls `incorporate` with dependency id, imported input, source alias and its registered worktree. This command requires a clean checkout, freezes the old/source heads and intended merge tree, verifies every changed path lies inside the transferred roots, and uses normal Git merge/commit with repository hooks and signing. Its durable intent and sealed receipt bind the actual merge parents/tree before another source attempt can use that base. A retry measures an already completed merge or resumes only its exact unchanged pending merge; it never resets local work. Changed symlinks, submodules, conflicting trees, dirty work and unrelated heads require owner repair.

`readiness` derives waiting-producer, waiting-import, waiting-incorporation or ready from the retained proof. Dispatch enforces the same facts, so only dependent nodes wait and no message is credited as completion. The Source coordination lock covers comparisons and durable admission, then releases before workers run. Missing ownership locators fail closed. Recovery of a dead lock owner is serialized; if that recovery itself crashes and leaves its recovery marker, automatic execution refuses until the owner inspects and repairs the lock. It does not claim unattended recovery from that second crash.

Completion retains all peer goals and uses the version 2 `workflow-peers` and `workflow-verification-report` schemas. The combined verifier's request freezes exact repository contributions and per-role runtime selectors. Each runtime role uses two independently accepted current no-op observations bracketing its actual API or browser verifier, including immutable endpoints, serving checkout, HEAD, generation and process identity. A mutating runtime receipt may establish the integration through the existing runtime owner, followed by those measured observations. Source context heads alone and a digest of separate consumer regressions cannot establish a tested combined runtime.
