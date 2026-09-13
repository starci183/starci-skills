# The workflow kernel (StarCi 5.0)

`execution/workflow-kernel.mjs` is the whole control plane of a job. One process per workflow: no Plan
Coordinator, no per-module Monitor, no provider chain. A **job** is any piece of work ("implement backend
feature A", "backend for three modules with the existing SRS/SDS", "write an SRS"); its **inputs** are typed
refs (`sds:path`, `srs:path`, `file:path`, `note:...`) of which specifications are one kind among many.

Entry points are the canonical launcher's commands, which route straight into `kernelMain`:

```
orca-supervised-launch.mjs workflow-goal    --job <text> [--lane [<name>]] [--inputs a,b] [--gates name=command,...] [--ledger work|plan] [--scope f1,f2] [--id <id>]
orca-supervised-launch.mjs workflow-approve --id <id> [--allocation <runtime>=<slots>[:<tiers>],...] [--allow-dynamic N] [--accept-critique "<reason>"]
orca-supervised-launch.mjs workflow-run     --id <id> [--from <own terminal> --run <run>] [--launch-file <f>] [--max-iterations N]
orca-supervised-launch.mjs workflow-status  --id <id>
orca-supervised-launch.mjs workflow-lane-close --id <id>
```

Every command also takes `--host-adapter orca|headless` (default `orca`, or `headless` when `STARCI_HOST=headless`
is set): see [Hosts: Orca and headless](#hosts-orca-and-headless-one-chat--one-workflow).

`--allow-dynamic N` raises this workflow's run-time operation budget (default `DYNAMIC_OPS_BUDGET` = 64) and
reinstates the operations the dynamic-op gate refused. Re-approving is how a user answers that gate.
`--accept-critique "<reason>"` is how a user approves a goal whose critique returned `refuse` (see **Phases**).

All runtime state of one workflow lives in one directory (`execution/workflow-store.mjs`):
`state.json` (atomic snapshot), `events.jsonl` (append-only audit), `goal.md` / `goal.json`, `contracts/`,
`reports/`, `checks/`, `validator/` (the validator's memory and verdict log), `final-report.json`.

## Two ledgers

A workflow's ledger is either the product's own or one a model assessed, and `--ledger` names which.
`detectLedgerMode` defaults it: a repository with `<repo>/.starciwork/features` is driven by its Work tree.

| | `work` (default with a Work tree) | `plan` (no Work tree) |
| --- | --- | --- |
| where the TODO list comes from | the authored Work tree, through the shipped validator | `assessGoal` invents it |
| what the model is asked | the definition of done, risks and questions | the whole plan form |
| what an op is | one step of the lane of one eligible `todo` node in `--scope` | one op of the assessed plan |
| goal text / allowlist / checks / acceptance | `description` / `implementation.changes[].files` / `extensions.work3.checks` / `assertions` | the model's op form |
| what an accepted slice writes | the node's `state`, `completion` and an evidence manifest - at the LAST lane step only - plus a `Work: <node id>` commit trailer | nothing outside the workflow directory |
| review granularity | one `review.verify` per module, for lanes whose template names it | one per connected ledger component |

A node that declares no allowlist or no checks is never guessed at - and it is not the user's chore either:
it is listed in `goal.md` under **Needs you first** as `ledger incomplete`, and the first ledger sync turns it
into one `work.author` operation whose write scope is that node's own `index.yaml`. See **Ledger incomplete ->
work.author** below. Decision nodes (`business`, `business-overview`, `architecture`) are listed too but never
launched into a worktree - a decision is answered. The exception is a reported `sds-gap`: see the policy table.

### Ledger incomplete -> work.author

`enrich` in `execution/work-ledger.mjs` marks a candidate `schedulable:false` with a `reason` when its record
declares no write scope (`implementation.changes[].files` or `extensions.work3.allowlist`) or no check
(`extensions.work3.checks`). Nothing of that node's lane may start, because the kernel would have to invent the
two things it refuses to invent. Completing the record, though, is work - reading the node, its neighbours and
the requirement and design it references, then naming real files and real commands - so `syncLedgerOps` creates
an operation for it instead of an item in `needUser[]`:

| | |
| --- | --- |
| kind / origin | `work.author` / `ledger` (so it counts against no dynamic budget) |
| id | `<node>-author`, recorded as `state.lanes[<node>].authored` |
| goal | `Complete the Work record of <node> so the kernel can launch it: <reason>` |
| allowlist | exactly one path: the node's own `index.yaml`, as `protectedPaths` names it |
| checks | one: `work-valid`, the kernel's own whole-tree validator |
| acceptance | the node declares an allowlist and checks that name its assertions; the tree validates |
| ledger items | none - the node enters `state.ledger` when its own lane starts, not when its record is written |

It is the one kind allowed to write its own node's `index.yaml`, which `kernelOwnedPaths` already permits for a
path an allowlist names exactly, so the contract's **Never touch (kernel-owned)** lists only that node's
`evidence/**`. What stays the kernel's *inside* the file is guarded by comparison instead of by path:
`launchOp` snapshots `state`, `completion` and `extensions.work3.kernel` right after its own `markInProgress`
write, and `guardRecordBlocks` reads them back before anything is verified. A moved block is reverted with the
rest of the file and the report is downgraded to `failed` and retried, exactly as a written kernel path is for
any other op. No proof by contrast applies (the op changes no spec), and the validator (the LLM one) sees the
record diff like any other op's diff.

On acceptance the kernel asks the tree, never the report: the ledger is reloaded and `executableCandidates`
re-enriches the node.

- **Schedulable now** - event `record-authored {node, op, allowlist, checks}`, and the node's lane creates its
  first step on the next iteration, with the node's own id, because the author op preceded the lane rather
  than walking a step of it.
- **Still not schedulable** - event `record-still-incomplete` and one `ledger` item in `needUser[]`. There is
  no second author op: one per node per workflow is the bound, and the record is now the user's to settle.

Either way the node keeps `state: todo` with nothing but the kernel's `in-progress` receipt. Authoring a record
is not completing work, so there is no `markDone`, no `completion` and no evidence manifest.

Two cases keep the 5.0 behaviour of a bare `needUser` item, because no operation here could hold the write
scope: a Work tree another repository owns (the record is not in this worktree at all, the same reason
`requestSharedChange` refuses ledger paths), and a node whose `index.yaml` the guard cannot name.

A third case is the same rule one layer out. A reported `grammar-gap` is grown in the repository that owns the
installed grammar, and the workspace binding is what names it: an optional `grammar` role beside `be` and `fe`
(`{pathFromSource, gitRepository, package?}`), carried onto `ctx.work.grammar`. A binding that declares none is
not a defect - it is a product whose grammar this workflow may not change - so the kernel creates no operation,
reopens nothing and leaves the requester `blocked` with one `environment` item naming the file that would answer
it. Inventing a repository root for a language is exactly the guess the routing contract forbids.

## Lanes and routes

One Work node is not one operation. It is a **lane**: the ordered kinds it travels before its ledger entry may
be called done. `profiles/kinds.yaml` declares the catalog and the lanes; `execution/kind-graph.mjs` reads it
(`laneFor`, `nextKind`, `routeFor`, `roleOf`, `familyOf`, `isReadOnly`, `describeLane`, `validateGraph`), and the
kernel only walks what it answers. Adding "frontend work is drawn before it is coded, and proved by a UAT run"
is a profile edit, not a patch to the control loop.

| lane | steps | who creates each step |
| --- | --- | --- |
| `implementation/backend` | `backend.implement` -> `review.verify` | the node, then the kernel's review planner |
| `design/ui` | `interface.draw` -> `interface.asset` (optional) | the ui node, both |
| `implementation/frontend` | `frontend.implement` -> `uat.verify` | the node, both - held (`lane-waits-design`) until the feature's ui node is done, a `design` question when the feature has none |
| `operations` | `runtime.operate` -> `review.verify` | the node, then the review planner |
| `uat` | `uat.verify` | the node |
| `architecture` / `business` / `brand` | `architecture.decide` / `business.decide` / `brand.decide` | answered as a decision, never launched |

The optional artwork step of the ui lane is decided by the node's own design record, not by a judgement:
see [Brand and artwork](#brand-and-artwork). The layout comes from the node path: a node under `implementation/frontend/**` takes the frontend lane, one
under `implementation/backend/**` (or any implementation node that names no layout) the backend lane. A `ui`
node is the feature's interface design record and walks the `design/ui` lane. `state.lanes[nodeId] = {lane, done, checks, head}` is the whole bookkeeping.

Three rules follow, and they are the difference from 4.x:

- **One step at a time.** A node yields its next operation only when the previous step is accepted and nothing
  of that node is still in flight. The op id is the node id for the first step and `<node>-<action>` after it.
- **The ledger hears `in-progress` until the last step.** Every accepted step writes `markInProgress` and a
  `lane-step` event; `markDone` - with the checks every step of the lane proved and one evidence manifest - is
  written only when `nextKind` answers null. So the node's completion is named after the step that completed
  its lane (a backend node's evidence record is the review's), and a half-built node is never `done` in the tree.
- **`review.verify` stays the kernel's.** The review planner creates it for a lane whose template names it; a
  frontend lane is proved by its own `uat.verify` step, so no review is planned for one.

A **route** is the same idea for a reported outcome: the graph says which kind answers it, under which origin,
what happens to the reporter (`pause`, `reopen`, `retry`) and with which bound. Every application appends
`routed {op, on, to, origin}`.

| on | routes to | the reporter | bound |
| --- | --- | --- | --- |
| `blocked` `sds-gap` | `architecture.revise` on the architecture node (its `index.yaml` plus its SDS folder), origin `architecture`, whose own check is that the Work tree still validates; `markDecided` bumps the node's `rev` | reopened behind it | - |
| `blocked` `interface-gap` | `interface.draw` on the same node, origin `architecture` | reopened behind it | - |
| `blocked` `grammar-gap` | `grammar.update` in the repository the binding's `grammar` role names, origin `architecture`, allowlisted to that repository and the canon | reopened behind it | 2 rounds; no `grammar` role means no op at all |
| `blocked` `shared-change` | the reporter's own kind, origin `shared` | paused | 3 new shared ops per iteration |
| review findings | the lane's build kind (so a finding on frontend work comes back as `frontend.implement`), origin `repair` | finished; the repair carries the work | 3 rounds per reviewed node set |
| `uat.verify` reporting `failed` | the lane's build kind, origin `repair` | reopened behind the repair | the same 3 review rounds |
| validator reject | retry of the same op | retried | 2 (`validatorRejectLimit()`) |
| `blocked` `environment` / `authority` | nothing | blocked, `needUser` | - |

Kinds younger than `ops/registry.yaml` are resolved to a launchable operator id once, at the launch seam:
`frontend.implement` launches as `interface.implement` and `architecture.revise` as `architecture.decide`
(`launchOperator`). The allocator is asked for the op's own kind, because `roleOf` from the graph is what
decides its role - the runtimes profile's `roleOfKind` map is only the fallback for a kind the graph lacks.

A profile that cannot be read is not fatal: the graph is empty, `WORK_OPERATION` maps the node kind as it did
in 4.x, every route falls back to its built-in default, and one `kind-graph-problem` event says so.

## Phases

**`goal`.** On the Work ledger the kernel loads the tree, lists the decision candidates and the schedulable
executable candidates in scope, derives one op per schedulable node and asks `assessGoal` only for the
definition of done, the risks and the questions; when that call fails the definition of done falls back to
the node list and the failure is an event, because the TODO list is a fact of the tree and not the model's
to supply. On a plan ledger `assessGoal` fills one form: the definition of done, a **ledger** of goal items,
and a dynamic list of **ops** with `dependsOn` and disjoint allowlists. Either way the kernel writes
`goal.md` and `goal.json` and stops. An item the plan reports as already `done` is carried as `preexisting`:
approved by the user, never verified by the kernel, and named as such in the final report.

**critique.** Every goal a person writes is challenged by the runtime before anything is planned from it, and
that challenge is a step of the goal phase, never a helper session. After the assessment and before the approval
page is written, `critiqueGoal` is called on the host's critics (`critique.runtimes` in config.json, astra then
fable by default: one call per goal, and Fable's week is the scarcer window) with the job text, the scope, the ledger items, the **decided** business and architecture records in scope
with the statements and acceptance criteria of their `srs`/`sds` payload (bounded to 40 records and 12k
characters), the brand when the tree has one, and what this runtime can and cannot verify. It answers one closed
verdict, and every objection must name its evidence - a record id, a rule statement, a fact of the job text -
because an objection without one is dropped by the kernel. The verdict lands in `state.critique`, in `goal.json`
and in the `## Phản biện (critique)` section of `goal.md` above the definition of done, with the event
`goal-critiqued`:

- **`sound`** - proceed as written. Nothing else follows from it.
- **`revise`** - proceed only under the changes in `required`. They are part of the goal the user approves, so
  `renderContract` renders them as `## Goal critique - required` under the goal of **every** operation of the
  workflow, above its allowlist: the operations honour the critique without anyone re-typing it.
- **`refuse`** - the goal contradicts an accepted record or cannot be verified at all, and the critique states
  the one question whose answer would unblock it. `approve` refuses until either the question is answered and the
  goal is written again, or the owner overrides the critique with
  `workflow-approve --id <id> --accept-critique "<reason>"`. The reason is recorded as `state.critiqueOverride`
  with the event `critique-overridden` and rendered on the goal page. An override is the owner's own decision, so
  the kernel never asks for it again.

- **`prerequisites`** - what the goal builds on that the tree does not hold: the `srs`/`sds` of the feature it
  extends ("add X to the backend" with no record of X), the `brand` a design needs, a `decision` nobody took.
  The kernel acts on them: a feature or brand record the tree lacks becomes the intake operation that authors
  it (`intake-planned` with `prerequisite`), and **every other operation of the goal waits for it** - the build
  starts from a record, never from the prompt. One the tree holds is `prerequisite-held` and changes nothing;
  a `decision` is the owner's (`prerequisite-owner`) and stays on the page under `### Prerequisites`.

A critic no provider could answer is `goal-critique-unavailable`: the goal page says `Phản biện: chưa chạy được`,
nothing binds an operation, and the workflow carries on - a dead provider is never a veto over the owner's job.

**approval.** `approve` sets `state.approved`. This is the only human gate; nothing is launched before it, and a
goal whose critique returned `refuse` is not approvable until the override above is given.

**`run`.** `runLoop` first runs the worktree **preflight** once (`kernel-guards.preflight`: `core.longpaths`,
the hooks environment for the kernel's own commits, the recorded `autocrlf` state, the branch) and appends one
`preflight` event; a fix it applied is recorded, a problem it cannot fix becomes a `needUser` item. Then, per
iteration:

1. **answer** every op waiting for an answer (`notifyTerminal`), then
2. **shared changes** - return every `paused` op whose shared op is `done` to `ready`, and create the shared
   ops a full earlier iteration had to queue, then
3. **lanes and review** - give every node whose previous lane step is accepted its next operation, and create a
   `review.verify` op for each ledger group whose implementing ops are all done and whose lane names that step, then
4. **schedule** - every op whose `dependsOn` are done, whose allowlist does not overlap a running op's
   allowlist and whose resource locks do not clash a running op's, up to `allocator.maxParallelOps`, gets a
   runtime from `allocator.allocate(kind,{avoid})`, a rendered contract, and a launch; then
5. **wait** - one `waitTick` on the workflow run (it classifies every live op), then
6. **accept** every report that arrived, then settle every op the tick found stalled or dead; and
7. when nothing is left to run: **gates**, then the **final report**.

Every iteration appends a `tick` event and saves `state.json`, so re-running `workflow-run` continues the
same workflow - the same counters, the same event log, the same ledger. The first binding of the Orca run is
the `run-bound` event; a kernel that already has its run (a resume, or a run handed in) appends `run-resumed`,
because re-binding a Run would invalidate every live Dispatch on it.

An op is `pending` -> `ready` -> `running` (`answering` while the kernel types an answer into its terminal,
`paused` while it waits for a shared change) -> `done` | `blocked`. `paused` counts as live: a job never
finishes while an op is waiting for someone else's change.

A ledger item moves `planned` -> `implemented` (an op's reproduced `done` was committed) -> `verified` (an
independent review accepted it); `preexisting` is the fourth state, for an item the approved plan reported as
already done. The workflow is `done` only when every item is `verified` or `preexisting` and the gates pass.

## What is machine-verified, and what the model is asked

The kernel never takes `done` on trust. For an accepted report it re-runs **every check command of that
op's contract** in the worktree (`spawnSync`, shell, 30 min default), computes the changed files from
`git status --porcelain` filtered to the op's allowlist, and commits them as `feat(<opId>): <goal>`.
A check the kernel cannot reproduce downgrades the report to `failed` with the failing check as the
finding, and the op comes back. The job **gates** are run the same way, by the kernel, never by an agent.

The model is asked for forms only, never for control flow:

| function | what it fills |
| --- | --- |
| `assessGoal` | a plan ledger: definition of done, ledger, ops (`starci/goal-plan@1`); on the Work ledger only the definition of done, risks and questions (`starci/work-goal@1`) |
| `critiqueGoal` | the objections to the goal itself (`starci/goal-critique@1`): one closed verdict `sound` / `revise` / `refuse`, evidenced objections, the required changes, the alternatives and the one question (see **Phases**) |
| `planOp` | the input form of one op that must be planned again after a design decision |
| `decide` | one option of a closed set when a bounded policy cell ran out |
| `validateOp` | the closed verdict of the workflow's one validator on a `done` the kernel already reproduced: `accept`, or `reject` with findings inside the diff (see **Validator**) |

Everything else - scheduling, allowlist arbitration, runtime choice, retries, commits, gates, the final
report - is this code.

## Brand and artwork

Two bodies of material stand behind every surface this kernel builds. The **grammar** is the host's and is the
same for every product (`knowledge/grammars/**`, `knowledge/patterns/fe/**`, `knowledge/ui/**`, listed by
`grammarReferences()`). The **brand** is the product's own and lives in the Work tree: one `brand` node whose
record carries the name, the design family, every colour token with the role it plays, the fonts, the mascot
and logo assets, what is forbidden and the rules every imagery prompt must carry. `execution/work-ledger.mjs`
answers it as `ledger.brand = {node, rev, file, spec} | null`, and `brandReferences(ledger)` names the record
file plus every `brand/assets/**` path beside it.

`DESIGN_KINDS` is the set of operations that read both: `interface.draw`, `interface.asset`,
`frontend.implement`, `uat.verify`. They are what `brand.decide` exists for, so for each of them the kernel:

- **references the brand.** `deriveWorkOp` adds the grammar canon and `brandReferences(loaded)` to the op's
  references; an op derived before the brand existed picks the record up at launch, so its contract never
  points at material that was not there yet.
- **prints it in the contract.** A short `## Brand` block under the references - name, family, rev, the record
  path and the mascot/logo assets - plus the one line it exists for: every colour, font, icon and illustration
  comes from that record and the grammar, and none is invented beside them. No other kind gets the block.
- **refuses to run without it.** A design op on a tree whose ledger knows about brands and carries no record is
  not launched: `schedule-deferred` with reason `brand missing`, and the op waits behind the `brand.decide`
  operation the kernel creates from the tree's own brand node (its `index.yaml` plus the folder its assets live
  in, origin `ledger`, one check: the tree still validates). A tree that carries no brand node at all is the one
  thing the kernel will not invent - a brand is the product's identity - so it asks once, as a `brand` needUser
  item: *no brand record: author `.starciwork/brand/index.yaml` (a work.author or brand.decide op)*.

A ledger build that does not answer the `brand` field at all leaves all of this off, so a tree that was never
asked about brands behaves exactly as before.

**The brand is a decision.** `brand` is a decision kind, so `decisionCandidates` lists it in goal.md,
`DECISION_OPERATION.brand` is `brand.decide`, and an accepted `brand.decide` is settled by `markDecided` with a
bumped `rev` - like `architecture.revise`, because every surface already built from the old brand was built from
something that has now changed. The kernel then re-reads the tree and records `brand-revised {rev, node, op}`.
That is all it does: the Work validator binds a completion to the digest of what it was built from, so the
frontend-facing nodes that were built against the old brand are reopened in the tree itself, and `syncLedgerOps`
picks them up on the next iteration like any other newly schedulable node.

**Intake is a reconciliation.** A new feature C is never appended beside the decided features A and B: the intake
reads every decided SRS/SDS record C touches, writes a reconciliation table into C's module record (fit,
change or conflict per record), references what C shares by record id, reports as `sds-gap` what A or B must
become (the kernel opens `architecture.revise` on that record - the intake never edits another feature), and
raises a real conflict as an open decision record of C for the owner. The result is one consistent A', B', C'.
`workflow-goal --reintake <feature>` runs the same intake op in reconcile mode over drafts the tree already
holds (`intake-planned {mode: reconcile}`), which is how a feature authored before this rule is brought under it.
The validator judges an intake by that rule, and the goal critique treats a goal that only appends as `revise`.

**Intake.** A `--scope` entry the tree does not know is not an error: the goal phase plans one intake operation
for it (`intake-planned`) and the tree, once it has the records, says what follows. `brand` becomes one
`brand.decide` op on `.starciwork/brand/**` that authors and decides the one brand record; a feature becomes one
`work.author` op on `.starciwork/features/<feature>/**` that mirrors the shape of an existing feature - module
record, business overview and SRS as full drafts, architecture skeleton - with every record `todo`, so the owner
reads drafts and the decisions stay the owner's. Neither op closes a Work node (`ledgerIds: []`); the records
it writes are the nodes the next `syncLedgerOps` sees.

An intake op's goal and acceptance are re-derived from the current build at every sync (`intake-retemplated`):
the validator reads the acceptance literally, so a wording the build corrected must reach the ops planned before
the correction; the allowlist and references stay what the owner approved.

An accepted intake is settled by what the tree holds under its scope (`intake-authored {records, decisions}`),
never measured as an incomplete record: the drafts are the owner's to read and the open decisions are the
owner's to take, so the workflow finishes `done` with them in its report.

**The design record is the feature's `ui` node.** Its `ui:` spec - surfaces, states, the candidate images under
its own `assets/` and the `artworkSlots` the drawing declared - is the authority for the interface lanes, and
`lanePredicates` reads it from disk (`designRecord`): a `ui` node reads itself, an implementation node reads
the ui node it references or the one beside it under `features/<feature>/ui`. The ui node walks `design/ui`
(`interface.draw -> interface.asset`); its drawing and artwork ops are granted the record's exact path, because
the design body is theirs to author. On a shared ledger those tree paths are located in the owner repository
(`locateSharedTreePaths`), because that is where the one tree is. When the ui node is recorded done, the
candidates its record names under the node's `assets/` become the hashed captures of its evidence
(`designEvidenceAssets`), which is what the `ui` completion profile requires.

| predicate | true when | effect |
| --- | --- | --- |
| `node.hasInterfaceDesign` | the record names its surfaces and the candidates that drew them | informational: the drawing is never optional |
| `node.hasNoArtworkSlots` | the record is drawn and declares no `artworkSlots`, or every slot names its generated `file` | `interface.asset` is skipped: there is no artwork left to produce |

A node whose record was never drawn satisfies neither, so both steps run: the default is to do the work, and
only the record may retire it. A slot is `{id, screen, state, region, purpose, brief, size, format,
references, crop, file?, sha256?, status?}`, which is what makes the asset step checkable - the files it
produced, against the slots that were declared. An implementation node is held before its first step
(`lane-waits-design`, once per drawing) while the feature's ui node is not done, and a feature with no ui node
raises a `design` question for the user: a build that invents its own screen leaves nothing for the walk to
compare against. An `interface-gap` from the build is drawn on that ui node, never on the build's code paths.
The lane bookkeeping prints the lane as walked: a step the record retired is in `skipped` and out of the
progress count. A lane templated by an older profile is re-templated at load (`lane-retemplated`) when nothing
accepted is lost.

**The validator is given the brand too**, trimmed to the fields a verdict can be founded on (`brandPayload`:
name, family, rev, colorTokens, mascotAssets, forbidden, imageryPromptRules) and with three rules that make it
binding: a design candidate or a built surface using a colour, font or icon outside the brand tokens and the
grammar is a defect; an `interface.asset` result whose slot files are missing, or whose artwork ignores the
brand mascot and logo references, is a defect; and a `frontend.implement` result that substitutes its own image
for a declared artwork slot, or omits one, is a defect.

## Validator

One validator per workflow, shared by every op, accepts or rejects every op result before the kernel commits
it - so an op that satisfied its own checks with a spec that cannot fail, or with code the goal never asked
for, does not get to fool the kernel. It is **an identity with memory, not a process**: not a long-lived agent
in a terminal (a serial bottleneck whose context rots and that would itself need supervising), but a headless
`validateOp` call the kernel makes per accepted result, with the same memory handed in every time.

**When.** In `applyOpReport`, after `machineVerify` and the proof by contrast have passed and before
`commitOp` and the ledger `done`. An op that changed nothing inside its allowlist (a review, an empty slice)
has no diff to judge and is skipped on the record (`validator-skipped` with the op).

**What it sees.** The op (id, kind, goal, acceptance, allowlist, attempt) and, on the Work ledger, the raw
node's description and assertions; the unified diff of the op's changed files against `op.baseHead`
(untracked files rendered as added; capped at 120 KB with a truncation note the validator can read); the
checks the kernel re-ran (name, command, exit code, output tail); `op.references`; and the memory.

**The verdict is closed.** `{verdict:'accept', summary}` or `{verdict:'reject', summary,
findings:[{file, line?, assertion?, detail}]}`. A finding whose `file` is not in the diff's file list is dropped
and recorded (`validator-finding-dropped`): the validator has no authority outside the diff. A reject with no
finding is an invalid form and is asked again; a reject whose every finding was dropped is no verdict at all.
An unparseable answer, a provider failure or an empty provider chain is `unavailable`.

**What the kernel does with it** (`op.validation = {verdict, summary, provider, at}` is stored either way):

| verdict | action | bound |
| --- | --- | --- |
| `accept` | `validated` event, then commit and ledger `done` exactly as before | - |
| `reject` | the report is downgraded to `failed`, `validator-rejected` is recorded, and the same op is relaunched with the findings (`retry`, reason `validator-reject`) - like a proof contradiction | 2 rejects of one op: the second sets it `blocked` with a `validator` needUser item and a `validator-exhausted` event, never a third launch |
| `unavailable` | never blocks: the commit proceeds, `validator-unavailable` is recorded and counted | 3 unavailable in a row: one `validator` needUser item names the outage; any accept or reject resets the count |

The verdict is data. It changes nothing except these transitions.

**Memory.** `<store>/validator/verdicts.jsonl` appends every verdict (op, head, verdict, findings, provider,
usage, reason). `<store>/validator/memory.md` is rebuilt by the kernel from it after each verdict: the job
rulings from `<store>/rulings.md` when present (binding), then the last 40 verdict lines `op | verdict |
summary` (a reject carries its first finding), oldest lines dropped until the page stays under 12 KB. The
whole page goes into every call, which is what keeps one validator consistent across ops.

**Runtimes.** `validator.runtimes` in `config.json` (default `[gpt-5.6-sol, claude-opus]`: Sol first, Opus as
the fallback) names the providers in order; the same `{runtimes: [...]}` shape as `supervisor`. A provider the
allocator reports as cooling is skipped rather than tried; a provider that errors moves the chain on. Usage is
read through `runHeadlessWithUsage` and recorded with the verdict. `runLoop({validateOp:null})` runs without
the validator and writes `validator-skipped` once; tests inject a stub the same way.

## The policy table

| result | action | bound |
| --- | --- | --- |
| `done`, checks reproduce | commit the allowlisted changes, ledger item `implemented` (`verified` for a review) with evidence `{opId, head}`, release the runtime | - |
| `done`, a check fails for the kernel | downgrade to `failed`, retry the same op with the failing check as the finding | retry bound |
| `done`, checks reproduce, the validator rejects | downgrade to `failed`, retry the same op with the validator's findings | 2 rejects per op, then `blocked` + `needUser` |
| `done`, checks reproduce, the validator is unavailable | commit anyway, count it | 3 in a row, then one `needUser` item |
| report fails `validateReport` | retry the same op with the rejection as the finding | retry bound |
| `partial` | resume the same op (`attempt+1`, `priorOpen` = `open[]`) | 5, then `decide` |
| `failed` | retry the same op with the failing checks as findings | 3, then `decide` (`retry-other-runtime` / `split` / `escalate-to-user`) |
| `ask` | `decide` `answer` or `escalate-to-user`; an answer is typed into the op's terminal and its report file is kept aside so it can report once more | - |
| `blocked` `shared-change` with paths | one shared op per distinct path set (a path-prefix overlap merges into the pending or running shared op and appends the requester); the requester is `paused` and returns to `ready` only when that op is `done`, carrying `priorOpen: ["shared change <op> done at <head>"]` | 3 new shared ops per iteration, the rest queued |
| `blocked` `shared-change` naming no path | treated as an `ask` to the kernel: the op is answered in its terminal with "name the exact paths" and reports again | - |
| a report whose op wrote a kernel-owned path | `revertProtected`, report downgraded to `failed` with the finding `operation modified kernel-owned ledger paths: <paths>`, op retried | retry bound |
| a Work node the ledger reports incomplete (no write scope, or no check) | one `work.author` op on that node's own `index.yaml`, origin `ledger`, checked by the whole-tree validator; on acceptance the tree is re-read - `record-authored` and the node's lane starts, or `record-still-incomplete` and one `needUser` item | one author op per node per workflow |
| an author op that moved `state`, `completion` or `extensions.work3.kernel` inside the record it authors | the file is reverted, the report downgraded to `failed` with the finding `operation modified kernel-owned fields (...)`, op retried | retry bound |
| an op created at run time past `state.dynamicOpsBudget`, or whose whole allowlist is outside `state.scope` | the op is created `blocked` and becomes a `needUser` item; `workflow-approve --allow-dynamic N` reinstates it | 6 dynamic ops per workflow |
| two `stalled-silent` settlements of one runtime within 30 minutes | `allocator.failed(runtime,{reason:'rate-limited (inferred from repeated silence)'})` and a `rate-limit-inferred` event | the window is cleared after it fires |
| `blocked` `sds-gap` | on the Work ledger: `markReopened` the architecture node the report names (or the one in the op's module) and create the route's `architecture.revise` op on that node's `index.yaml` and SDS folder, whose own check is that the Work tree still validates; `markDecided` settles it with a bumped `rev` when the op is accepted. On a plan ledger: an `architecture.decide` op on the design inputs, re-planned with `planOp` afterwards. Either way the blocked op depends on it and resumes afterwards | - |
| `blocked` `interface-gap` | the route's `interface.draw` op on the same node; the reporter is reopened behind it | - |
| `blocked` `grammar-gap` | the route's `grammar.update` op, allowlisted to the `grammar` repository of the workspace binding plus the canon (`knowledge/grammars/**`, `knowledge/patterns/fe/**`) and to nothing of the product, with the whole canon as its references and the acceptance "the grammar renders `<detail>`", "published at a new version and the consumer imports it", "the canon names the new unit"; the reporter is reopened behind it and reads the canon again. A binding with no `grammar` role creates nothing: one `environment` item naming `role \`grammar\` in .workspaces/projects/<project>/work.json`, a `grammar-unbound` event, and the requester stays `blocked` | 2 rounds per node |
| `blocked` `environment` / `authority` | `needUser`, op blocked | - |
| review with findings | one repair op of the lane's build kind on the files the findings name inside the group's allowlists, then a fresh review | 3 rounds per ledger group |
| a `uat.verify` op reporting `failed` | one repair op of the lane's build kind, and the UAT run itself reopened behind it | the same 3 rounds per node set |
| failing gate | one repair op whose findings are the tail of the gate output, then the gates again | 3 rounds |
| `stalled-prompt` / `stalled-silent` / `dead` from the tick | `settleDispatch(close)` and requeue on another runtime | 3 restarts |
| nothing launchable and nothing running | `needUser`, stop `blocked` | 3 iterations |

A review never runs on a runtime that implemented the ledger items it judges (`avoid`), and two ops whose
allowlists overlap - or whose resource locks clash - never run at the same time, so one worktree stays safe
for a whole pool.

## The guards the kernel owes itself

`execution/kernel-guards.mjs` is the only place these mechanical protections live; the kernel reaches every
one of them through `ctx.guards` (default `kernelGuards`), so a host or a test can inject the contract, and a
tree shipped without the module falls back to a minimal implementation of the same contract.

| guard | what the kernel does with it |
| --- | --- |
| `protectedPaths(node, repoRoot)` | the node's `index.yaml` (where `state`, `completion` and `extensions.work3.kernel` live) and its `evidence/**`. Every contract of that node lists them under **Never touch (kernel-owned)**; `changedFiles` excludes them, so no operation commit can ever carry one. An op is granted one only when its own allowlist names that exact file - how an `architecture.decide` op authors the design body of its node, and how a `work.author` op authors the record of its own - never through a directory glob. Inside a record an author op holds, `state`, `completion` and `extensions.work3.kernel` are still the kernel's, guarded by `guardRecordBlocks` comparing them before and after |
| `revertProtected(git, {cwd, paths})` | run before any machine verification. The kernel fingerprints those paths right after its own `markInProgress` write, so only the operation's edits are caught; a changed fingerprint is reverted and the report is downgraded to `failed` with the finding `operation modified kernel-owned ledger paths: <paths>`. A completion an agent writes itself is a claim, not a record |
| `resourceLocks(op)` / `resourcesClash(a, b)` | the declared `op.resources` plus what the op's kind and check commands prove it reaches for (`postgres`, `e2e-runtime`, `docker`, `cluster`). The scheduler treats a clash exactly like an overlapping allowlist, and the contract renders them under **Resources** |
| `gitQueue(fn)` | every git mutation the kernel makes - the op commit, the ledger commit, a protected-path revert - runs alone through this queue, because one worktree has one index |
| `preflight({worktree, git})` | once at the start of `runLoop`: the fixes it applied and the problems it could not are one `preflight` event, `state.preflight`, and - for a problem - a `needUser` item |

## Bounds on what a run may grow

The kernel creates ops at run time (reviews, repairs, shared changes, design decisions, gate repairs, newly
schedulable Work nodes). Two bounds keep that from drifting away from what the user approved:
`state.dynamicOpsBudget` (64) caps how many run-time ops a workflow may create, and an op whose whole
allowlist falls outside the approved `scope` is refused the same way - matched against the scope entries that
name a path or a feature folder, since a scope given as a Work node id constrains the ledger and not a file
path, and never against an op derived from a node the ledger already scoped. A refused op is still
created - so the graph and the final report name it - but it is `blocked` with a `dynamic-op` entry in
`needUser[]`, and `workflow-approve --id <id> --allow-dynamic N` is how the user lifts it.

A shared change is the other growth path, and it is disciplined: the blocker must name concrete repository
paths (one that names none is sent back to the operation as a question), identical and prefix-overlapping path
sets share one op with every requester appended to it, at most three new shared ops are created per iteration,
and a requester waits `paused` - never `pending`, so nothing reschedules it early.

Anything the table cannot settle becomes an entry in `needUser[]`, and the workflow stops with outcome
`blocked` and a `final-report.json` that says exactly what a human has to decide.

## Writing the ledger back

Every write to a Work node goes through `execution/work-ledger.mjs`, which owns exactly four things -
`state`, `completion`, `extensions.work3.kernel` and the evidence manifest - and preserves every other
authored line byte for byte. The kernel calls it at four points:

| when | call | what it records |
| --- | --- | --- |
| an op launches | `markInProgress` | `opId` and `dispatch` in the kernel block; `state` stays `todo`, because Work v2 authors only `uninvestigate`, `todo` and `done` |
| a lane step is accepted and another follows | `markInProgress` again + a `lane-step` event | the step that just landed; the node is still `todo`, because its lane is not walked |
| the LAST lane step is accepted | `markDone` + its evidence manifest | the checks every step of the lane proved, the assertion each one covers, the head, and a `completion` bound to the digest the validator reports after the kernel block was written |
| a decision op is accepted | `markDecided` | a collocated `starci/design-review@1` with one observation per authored assertion - a decision is never settled by an execution receipt |
| a reported `sds-gap` | `markReopened` | the node returns to `todo` with the reason, and its stored proof is kept as history |

A refused write is never silent and never fatal: `work-ledger` restores the node's original bytes, the
refusal is a `ledger-write-failed` event, and the workflow carries it to the user instead of reporting a
green slice over a ledger that does not say so. The most common refusal is honest - `markDone` will not
write `done` unless a passing check proves every assertion the node authored.

The op's own commit carries a `Work: <node id>` trailer; the kernel's ledger write is committed after it, in
its own `work(<node id>): ...` commit scoped to that node's directory, so the tree is never left dirty. Both
commits go through `gitQueue`, and the node's `index.yaml` and `evidence/**` are kernel-owned for the whole
life of the op: see the guards above.

### When the ledger belongs to another repository

The tree a job works is resolved once, before the store exists, by `execution/ledger-routing.mjs`:
`--ledger-root`, else the host route registry, else `<repoRoot>/.starciwork`. A frontend job therefore works
the Work tree its backend owns — see **Shared ledger across repositories** in
[work-ledger.md](work-ledger.md) for the resolution rules and what a shared tree changes.

Inside the kernel this splits `ctx.work` in two: `ctx.work.code` is `{repoRoot,origin,repository}` of the
worktree this kernel commits code in, and `ctx.work.ledger` is `{repoRoot,workRoot,repository}` of the tree
it records Work in (`ctx.work.at` is the `{repoRoot,workRoot}` pair every `work-ledger` call takes, and
`ctx.work.shared` says whether they differ). Candidate filtering asks with `ctx.work.code.repository` and
`ctx.work.side`, so a frontend workflow picks only the nodes its repository delivers; source identity and
evidence name `ctx.work.code`; the ledger write and its commit happen in `ctx.work.ledger`. `state.ledgerRoot`
and `state.ledgerOwner` are written at goal time and reused on every resume, `workflow-status` reports both,
and `workflow-goal|run|status` all accept `--ledger-root`. The workflow directory itself follows the ledger:
a repository that shares another's tree keeps no `.starciwork` of its own, so
`.starciwork/_local/workflows/<id>` lives in the owner.

A shared-ledger run records `ledger-shared {owner,root}` on its `ledger-loaded` event and refuses to start at
all when the owner's tree carries pending changes the kernel does not own (`ledger-shared-dirty`, then
`blocked` with a `needUser` item naming the files).

## Lanes: one workflow, one worktree

A **lane** is the worktree one workflow owns. This is not the kind lane a node travels ([Lanes and
routes](#lanes-and-routes)); it is the place the whole workflow happens: the kernel, every operation and every
commit of that workflow, on a branch of its own, as one top-level Orca row `[Workflow] <id>`. Two workflows
never share a worktree, because that is what made three workflows' agents hang under a single row with no way
to tell whose operation was whose.

`workflow-goal --lane [<name>]`, run from the base worktree (repository R on branch B), does four things
before the goal phase:

1. `orca worktree create --repo path:<R> --name <name> --base-branch <B> --setup skip --no-parent` - the lane
   is a git worktree of R on a branch Orca names; the receipt's path and branch are recorded, never guessed.
   The default name is the workflow id. A name Orca already has is Orca's refusal, surfaced as it came.
2. `orca worktree set --display-name "[Workflow] <id>" --workspace-status in-progress` - the row the owner reads.
3. the goal phase runs with `worktree = <lane path>` and `branch = <lane branch>`, so every operation, check
   and commit of this workflow happens in the lane; goal.md names the lane and the base under its title.
4. `state.lane = {name, worktree, branch, orcaId, base:{worktree,branch}}` is a fact of the workflow from then on.

`--lane` is refused from inside a lane (`state.lane` of another workflow pointing at this worktree): a lane
never opens a lane of its own.

**Where the store is.** The lane does not move the workflow directory: `createStore({repoRoot})` resolves the
repository through the git common dir, which a lane shares with its base, so
`<R>/.starciwork/_local/workflows/<id>` is found from the base worktree and from the lane - the supervisor
polls either one and starts the kernel with `cwd` = the lane.

**The ledger.** A lane of the repository that OWNS the Work tree has its own `.starciwork` on its branch, and
that is the point: those records are merged back with the code. A lane of a code repository that routes to a
shared ledger (a frontend) keeps writing the owner's tree exactly as before - the lane changes the code root,
not the routing.

**Merge-back.** When the workflow finishes `done`, `finish` runs in the base worktree:

```
git merge --no-ff --no-edit -m "merge(workflow): <id> - <lane branch> into <B>" <lane branch>
```

On success: `lane-merged {id,branch,base,commit}`, `orca worktree set --workspace-status completed`, and the
lane worktree is left in place for the owner to read. On a refusal - a content conflict, a pending change in the
base that the merge would overwrite, or a base worktree that has since moved to another branch (a merge takes
whatever is checked out there, so a different branch is not this lane's merge at all) - the merge
is aborted, `lane-merge-conflict {files}` is recorded, a `needUser` item of kind `merge` names the files, and
the workflow finishes **blocked** instead of done. Nothing in the base worktree is ever stashed, reset or
force-merged: it may be somebody's working copy with a kernel of its own. The work is not lost either - it is
committed on the lane branch, waiting for the merge the owner performs.

`workflow-lane-close --id <w>` removes a merged lane's worktree (`orca worktree rm --force`) and keeps its
branch (`lane-closed`, with the preserved branch). It refuses while the kernel is alive (`workflow-stop`
first) and while the lane has not been merged.

## The single-candidate launch

5.0 allocates one runtime per op, so the launcher must try exactly one candidate.
`startOperation(input,{candidates})` is that seam: the launcher takes the resolved selection instead of
resolving a chain, so nothing has to pretend a target was unavailable. `launchWithCandidate` still proves
the allocated target belongs to the operation's declared environments, rebuilds the request from the
candidate alone so a mismatch is caught before any Orca effect, and records **why the other targets were
not used in the kernel's own `launched` event** (`allocation.notAllocated`), never as a fake launcher
attempt. Allocation itself is kept inside `allocator.launchableTargets(kind)`, so a runtime whose role has
no profile for that operation is never chosen and then rejected.

## Runtimes are shared across workflows

Several workflows of one repository run at once, each with its own kernel and its own allocator, and the
expensive runtimes are split across them, not owned by one. One file says so: the shared runtime ledger
`<workflowsRoot>/runtime-loads.json` (`execution/runtime-loads.mjs`, schema `starci/runtime-loads@1`), beside
the workflow directories every kernel of the repository already shares.

```json
{"schema":"starci/runtime-loads@1","runtimes":{"claude-fable-5.1":{
  "live":[{"workflow":"20260912-101500-nivo-setup","op":"op-decide","since":1789000000000}],
  "cooling":{"until":1789000600000,"reason":"HTTP 429","kind":"rate-limited","workflow":"20260912-101500-nivo-setup"},
  "usedToday":3,"day":"2026-09-12"}}}
```

The kernel records a launch (the allocation was accepted **and** the operation actually launched), a release or
a failure, and a provider cooldown; at start it drops its own leftovers - entries of this workflow whose
operation is no longer running (`runtime-loads-swept`). Writes are atomic (temp file, rename) under a `.lock`
beside the file carrying pid and timestamp, retried with short waits and broken when it is stale (30 s) or its
pid is dead. Entries of a workflow whose kernel is dead - no live pid in its `kernel.lock` - are ignored on
read and dropped on the next write, so a crashed kernel never holds a slot of Fable for the others. A
cooldown outlives the kernel that found it: the limit belongs to the provider.

What it changes in allocation, with `createAllocator({shared:{path, workflow}})`:

- another kernel's live operations on a runtime count as **load**, so `maxParallel` is the runtime's cap across
  the repository instead of per workflow;
- a cooldown another kernel ran into is a cooldown here (`runtime-cooling-shared {runtime, until, from}`, once
  per learned cooldown); only provider limits are published - a rate limit and an exhausted quota - while an
  auth or local failure stays the kernel's own;
- among the candidates that all qualify - role, free slot, budget, no cooldown - the one **no other kernel is
  using** wins, and inside one shared load the local order decides (preference, then ratio, then chain order).
  So a second workflow's hard operation goes to Astra while Fable carries the first one's, and the receipt says
  so: `allocation-shared {op, runtime, preferredOver:[...], sharedLoad:{runtime:n}}`.

The quota proposal reads the same file: when the first runtime of a kind's launch chain carries live operations
of another workflow, the next chain runtime that has the role is proposed a slot too, with the reason in the
row (`... is busy with <workflow>`), so a lane opened while another lane is on Fable proposes Astra without the
owner saying "prefer Astra, Fable is busy".

What it never changes: **a workflow's own quota.** The slots and order the user approved stay that workflow's
cap, the per-workflow `maxParallelOps` is unchanged, and nothing shared ever widens them. And the ledger is
never a gate: an unreadable, missing or foreign file reads as nothing shared, so allocation degrades to the
local behaviour and a launch is never blocked by it.

## The operation contract

`renderContract` owns every concrete value - the lane line (`Lane: interface.draw -> frontend.implement ->
uat.verify (this op: step 2 of 3)`, so an operation knows what came before it and what will judge it), goal,
goal items, allowlist, the kernel-owned paths the op may never touch, its resource locks, references, inherited
open items, findings, acceptance, the exact check commands, the checks file, the report command with
`--reports-dir`. A design-family operation also gets the short `## Brand` block under its references (see
[Brand and artwork](#brand-and-artwork)).
Between the acceptance and the process prose it splices the kind-specific working order from
`execution/contract-steps.mjs` (`stepsFor`): see [op-granularity.md](op-granularity.md), "Working order per kind".
The process prose (`## Cook until done`, `## Ping (mandatory)`, `## Never`) is reused verbatim from
`docs/supervision-templates/op.md`, so one template serves every operation kind and no placeholder survives
into a rendered contract.

## The final report

`final-report.json` carries the outcome and reason, the branch and head, the definition of done, every
ledger item with its evidence, the gates, `needUser[]`, and every op with its runtime, node, commits and
verdict. On the Work ledger it also carries `ledgerMode`, `scope`, the open `decisions` and a
`ledgerSummary` re-read from the tree at the end, so the report states what the ledger says now rather than
what it said at approval.

## Supervision without an agent (5.1)

A workflow has no monitor agent. Three layers keep it running on their own:

- **Supervisor (process, `workflow-supervise`)**: one long-running program per repository. Every poll it reads `_local/workflows/*/state.json`, `events.jsonl` and `kernel.lock`; an approved, unfinished workflow with no live kernel is started (`workflow-run` detached), a kernel whose log stays silent past the health window (default 25 min, one wait tick plus slack) is killed and started again. Finished, stopped (`stop.flag`) or unapproved workflows are left alone. Log: `_local/workflows/supervisor.log`.
- **Reconcile (kernel, start + every 10 ticks)**: the kernel compares Orca's `worker-list` of its Run with `state.ops`; a live Dispatch no operation names is an orphan and is settled (`reconciled-orphans` event). This is what a restarted kernel needs to trust its own state again.
- **Triage (LLM, closed options)**: the policy table handles known outcomes (done/failed/question/shared-change/stall/rate-limit). When the same anomaly signature repeats `TRIAGE_AFTER` (3) times, the kernel asks the `decide` function once, offering only `resume-ops | park-runtime | settle-op | restart-kernel | needUser`; the pick is applied, recorded (`triage` event) and never asked again for that signature in the workflow. Without a decider (tests, `--functions` off) triage is a no-op and the anomaly stays a counter.

```
node .claude/.dist/execution/orca-supervised-launch.mjs workflow-supervise --host <path-to-.claude> [--once true] [--id <workflow-id>] [--poll-ms 60000] [--health-ms 1500000]
```

### Supervisor level

`config.json` (host-local, gitignored) may carry `supervisor.runtimes`: the models triage and the `decide` role prefer, strongest first. The default is `[claude-fable-5.1, gpt-6-astra]`; lower it (for example to `[claude-opus]`) to save budget. Only ids declared in `profiles/runtimes.yaml` take effect; the rest of the profile's `decide` preference follows.

### Review rounds and the dynamic budget

A review round is counted per reviewed node set (`verifyRounds[<ids joined by +>]`), never per feature: counting per module burned a feature's three rounds on three different nodes. After the last round the group is parked as `review-exhausted` with one needUser item instead of being re-planned every tick. Ops the kernel derives itself (origins `ledger`, `verify`, `gate`, `architecture`) never count against `--allow-dynamic`; only `shared` and `repair` ops do, and `--allow-dynamic 0` forbids them.

## Terminals

The kernel is one Orca tab, `[Kernel] <id>`, in its worktree, and that tab is the Run's coordinator: a start
reuses the tab a previous start left (and closes a duplicate); a pause or a rebuild leaves it in place; only a
finished workflow closes it (`kernel-terminal-closed`). A kernel that finds the Run bound to a tab that is gone
re-binds the Run to its own tab once (`run-rebound`), which fences the old tab's live Dispatches. An op's tab
is closed when its report is accepted (`op-terminal-closed`); a blocked or failed op keeps its tab, which is
where its last words are. Every reconcile also sweeps what an older build left behind - stale `[Kernel]` tabs
and done-op tabs of this workflow (`terminals-swept`) - and never touches another workflow's tabs.

## The worktree is trusted before the agent opens it

A TUI agent asks whether it may trust a folder it has never been opened in, and Orca's pasted task lands in
that dialog: the start times out (`agent_prompt_stalled`) and the agent exits. Before every managed launch the
launcher grants trust to the exact worktree the way the agent records the owner's own answer - Claude Code in
`~/.claude.json` (`projects[<path>].hasTrustDialogAccepted`), Codex in `~/.codex/config.toml`
(`[projects.'<path>'] trust_level = "trusted"`) - touching nothing else in those files; the attempt record
carries `trust: {action: trusted | already-trusted | no-dialog}`.

## The owner is asked, the model never decides for them

A question an operation raises that is not mechanical (a business rule, a design choice, an authority, a
credential the environment lacks, money, customer data) pauses that operation and opens one `owner.ask` op
(`owner-ask-opened`). That op first reads the decided records: a record that settles the question answers it
(`answered-from: <id>` - the answer reaches the requester in its next contract, `owner-answer-delivered`).
Otherwise it writes one decision record draft in the feature's decisions folder - the question, why it matters,
numbered options analysed per side (architecture, user stories, security and authority, business rules,
quality), the decided records each touches, and one recommendation - and the workflow lists the question for
the owner (`needUser` kind `decision`, `owner-question`). The owner answers with
`workflow-answer --id <wf> --op <ask op> --choice <n> [--note "..."]` (queued to a live kernel's inbox); the
answer is delivered to every requester (`owner-answered`). The supervisor model answers only questions whose
`question.kind` is `mechanical` (which runtime, a retry, a format). A blocker `environment` or `authority`
whose detail names a variable, a key, a token or a credential is the same owner question (`credentialNeed`).
Every contract carries the credential rule: a key the environment lacks is reported `blocked` with the exact
variable name, never invented, stubbed or silently skipped, and no secret value is ever written anywhere.

## A tab exists only while its op runs

Every five minutes (and at every reconcile) the kernel closes every tab of this workflow that nobody reads:
a stale kernel tab, the kernel tab of a sibling workflow of the same store root that finished or whose kernel
is gone, and the tab of any op that is not on it right now - matched by the handle the op holds as much as
by its title, so a tab whose rename never landed is found too - done, blocked, retried or pending alike
(`terminals-swept` with the op's status as the reason). Tabs of other workflows and tabs the owner
opened are never touched. A kernel paused by `stop.flag` closes its own tab too (`kernel-terminal-closed`
with the reason); the next start opens one and re-binds the Run.

## The validator judges by the record on disk

The brand payload the validator receives is read again from disk when the op wrote the brand record itself:
the summary the last sync read is what the op was told to change, not what it is judged by. A retry closes
the failed attempt's tab and a validator-exhausted block closes the op's tab (`op-terminal-closed`): a tab
without a reader is not left idle in the sidebar.

## A command reaches a running kernel within one tick

The wait for running operations is sliced (`tickMs`, two minutes), and between two slices the kernel looks
for a queued inbox command or a stop flag: either ends the wait (`wait {result: "woken"}`) so the next
iteration applies it, instead of the command sitting until the whole wait for the running operations is over.

## Avoided runtimes expire

A runtime an op learned to avoid - it failed to launch there, stalled there, was rate-limited there - is
avoided for the rate-limit cooldown (one hour), not for ever: the avoidance carries its stamp
(`op.avoidedAt`) and `readmitCooled` opens the runtime to the op again once the cooldown has passed
(`avoid-expired`). A verify op's avoidance of its implementers carries no stamp and never expires: that one
is independence, not a failure.

## Approving again after a blocked finish

A workflow that finished `blocked` stopped for the owner's decision, and `workflow-approve --id <id>` on it is that
decision: the finish is cleared (`resumed-after-block`, with the ops it re-admits) and every op a limit had
exhausted - the validator's two rejections, the launch attempts, the restarts, a stall - goes back to `ready`
with its counters at zero, the runtimes it had learned to avoid open to it again, and its question gone
(`op-readmitted`). An op the kernel refused on principle
(superseded, out of the repository, a dynamic op over budget) stays refused: approving again changes nothing
it was refused for. The supervisor then starts the kernel, which carries on from where it stopped.

## Strays that break the tree are quarantined

An invalid tree whose every error sits under an untracked path that no live operation owns is what an
abandoned operation left behind - never the owner's draft, which would be tracked or owned. The kernel moves
those paths whole to `<store>/strays/<timestamp>/` (`stray-quarantined`), reads the tree again, and when it is
valid again (`ledger-valid-again`) re-admits the ops the validator had exhausted only for a red whole-tree
check (`op-readmitted`). One error on a tracked or owned path and nothing moves.

## Hosts: Orca and headless (one chat = one workflow)

The kernel runs on a **host**, and it reads exactly three things about it: a name, the capabilities it offers
and whether it runs operations in parallel (`hostDescriptorOf(orca)`). Two hosts exist.

- **Orca** - `execution/orca-calls.mjs`, `ORCA_HOST = {name:'orca', capabilities:['design-tool'], sequential:false}`:
  the multi-agent IDE with terminals, a dispatch mailbox and a run coordinator, the runner every command always had.
- **Headless** - `execution/orca-headless.mjs`, `HEADLESS_HOST = {name:'headless', capabilities:[], sequential:true}`:
  the same `invoke(command, params, {cwd}) -> starci/orca-call-result@1` surface, answered with child processes
  and files, so not one line of the kernel knows which host it is on. It is what a plain Claude Code chat or a
  Codex chat uses to drive a workflow without Orca: **one chat = one workflow**, not multi-agent - operations
  run one at a time as headless CLI processes (`claude -p`, `codex exec`, `qwen`) in the workflow's worktree.

**Selection.** Every launcher command takes `--host-adapter orca|headless` (default `orca`); `headless` is also
selected when `STARCI_HOST=headless` is in the environment, which is what the kernel sets on every operation
process it spawns, so a child's own `report` reaches the host mailbox with no flag. `workflow-run` records the
host as `state.hostAdapter`, and the supervisor starts the next kernel of that workflow with the same
`--host-adapter`: a workflow never changes host behind the owner's back. The supervisor itself only spawns
launchers, so `workflow-supervise` works on either host; on the headless one its budget probe reports
`budget-probe-failed` with the host's reason (see `account list` below) and the last written budget stands.

**What the headless host does with each call.** Its files live in `<store>/headless/` once the kernel has bound
its workflow store (`bindStore`), and in `<repo>/.starciwork/_local/headless/` before one exists (a lane opened
at goal time). A child process finds the same directory through `STARCI_HEADLESS_ROOT`; a `report` run by hand
finds it beside the `--reports-dir` it was given.

| call | headless answer |
| --- | --- |
| `worker-start` (managed agent) / `dispatch` (command terminal) | spawns the runtime's own headless command line from `HEADLESS_PROVIDERS` (`claude -p --output-format json`, `codex exec --json`, `qwen --approval-mode yolo ...`), detached, in the operation's worktree, with a short preamble (task, dispatch, terminal handle, "there is no `orca` here, skip the ping") plus the contract on stdin; stdout/stderr go to `<dispatch>.log`, the prompt to `<dispatch>.prompt.md`. Permissions are exactly what those command lines carry and nothing more. A launch asked for with no model passes none - the agent's own default, as Orca's `worker-start` without `--model` - and reports `model: null` back. A model no headless line exists for is a failed launch (`no headless command ...`), never a substitute |
| `send` / `check` | `send` appends one line to `mailbox.jsonl`; `check` reads the unacknowledged messages of the run, hands them out under a delivery id, acknowledges a delivery on `--ack` and delivers an unacknowledged one again, so `singleTick` works unchanged. A blocking check ends when a message lands, when a process it watched exits, or at the timeout. A `--peek` for heartbeats answers one ping per live process: liveness is the heartbeat this host can vouch for |
| `worker-list`, `task-list`, `terminal-list`, `dispatch-show`, `worker-show`, `run-*` | `table.json`, every pid checked alive on read. A dispatch stays listed until the kernel releases it, because the kernel settles only what it is shown. The run coordinator is the handle string the kernel gave (`term_h<n>`, its own synthetic terminal, found again by title on the next start) |
| `terminal-create/read/send/rename/close` | handles in the table, no pty. A terminal's screen is made of the facts of its process: running for N minutes with the busy markers, exited (with the log tail), or past the wall-time bound (90 min, the same bound the Orca qwen command line carries) with no activity claimed. `send` to an exited process is a failed call, so the kernel records an answer as undelivered instead of believing a screen; `close` on a live process ends it - the terminal is the process here |
| `worktree-create/set/show/rm` | `git worktree add -b workflow/<name> <repo>/.worktrees/lanes/<name> <base>`, a metadata write, `git rev-parse`, `git worktree remove` with the branch preserved |
| `agent-context` | the calls contract itself, so `verify` passes |
| `account list` | `outcome: 'unsupported'` with a reason, never a throw; `probeBudget()` returns `{ok:false, reason}` |

**Sequential, by construction.** `createAllocator({sequential:true})` (`sequentialRuntimes`) caps
`maxParallelOps` at 1 and every pool at one slot, after the quota is applied so no approved allocation widens
it; `workflow-run` passes `host.sequential`, and the `host` event of every run says so. Two reasons, both
structural: the operations are detached processes in one worktree with no terminal to supervise them from, so
two of them would race on the same index and the allowlist arbitration a chat cannot see; and one chat drives
one workflow - the owner reads one operation's outcome at a time. The scheduler's overlap, resource-lock and
dependency rules still apply on top.

**Liveness without a screen.** A headless process prints nothing until its turn ends, so the observer reads
facts instead: a live pid inside the wall-time bound is `working` (and pings), a gone pid is `dead` (the kernel
settles it and relaunches on another runtime, as for any dead worker), a live pid past the bound is
`stalled-silent` and is settled the same way. An `ask` cannot be answered into a process that has already
exited: the kernel's answer is recorded as undelivered, the op is relaunched, and the answer travels in the
contract of that next attempt (`## Answer to the question you asked earlier`) - on every host alike.

**Capabilities.** `profiles/kinds.yaml` may give a kind `needs: [<capability>]` from the closed vocabulary
`capabilities` (`design-tool`; `CAPABILITIES` in `execution/kind-graph.mjs`, `needsOf(kind)`). `interface.asset`
needs `design-tool` (the image model that generates the declared artwork), which only Orca declares; every other
kind runs anywhere - `interface.draw` included, because a drawing is the installed grammar rendered in a browser
(one candidate per screen and viewport, the main state only; loading, empty and error are described in the
record and rendered by the build from the grammar's state contracts), never an image-model painting. At schedule time an op whose kind
needs what the host lacks is refused: `blocked` with `refusal: 'host-unsupported'`, one needUser item
`{op, kind:'host', detail}`, event `op-host-unsupported {op, kind, host, missing}`, and the workflow carries on
with everything else. On a frontend feature that means the design gate keeps holding the `frontend.implement`
lane behind the ui node (`lane-waits-design`) - correctly: there is no drawing to build from - so the workflow
finishes `blocked` naming the host item and the ledger items it could not verify. `workflow-approve` from a
host that has the capability re-admits such ops (`op-readmitted {op, host}`), clears their host item and, as
for any blocked finish, lets the supervisor start a kernel on that host; an approval from a host that still
lacks it changes nothing. An approval queued to a *live* kernel (the inbox) is applied by that kernel on its
own host, so the re-admission is given to a kernel on the capable host: stop the headless kernel, then approve
from Orca.

**Driving a workflow from a chat (Claude Code or Codex).** The assistant is the owner's hands, never an agent
of the kernel:

1. `workflow-goal --job "<text>" [--lane] --host-adapter headless` (or export `STARCI_HOST=headless` once);
   the assistant reads `goal.md` back to the owner, who approves in the chat.
2. `workflow-approve --id <id>` - the one human gate, unchanged.
3. `workflow-run --id <id> --host-adapter headless` in the background (or `workflow-supervise --host <.claude>`
   with `STARCI_HOST=headless`, which restarts the kernel after a crash or a rebuild exactly as on Orca).
4. The assistant polls `workflow-status --id <id>` and the events, relays every `ask` the kernel escalated
   (`needUser` kind `authority`) and every other needUser item (`host`, `ledger`, `environment`, ...) to the chat,
   and the owner answers with the commands of the table below - `workflow-approve` again, an authored record, a
   `workflow-stop`. `.starciwork/_local/workflows/<id>/headless/<dispatch>.log` is where an operation's process
   left its output when the assistant needs to read one.

## Operating a running workflow

Everything an operator does is a command or a file the kernel reads; nothing is a write to `state.json`, which
the kernel holds in memory and saves over at every tick.

| you want | do | the kernel |
| --- | --- | --- |
| raise the run-time op budget or change the allocation of a running workflow | `workflow-approve --id <w> --allow-dynamic N` / `--allocation ...` | queued in `<store>/inbox/`, applied at the next tick (`inbox-applied`); a new allocation ends the loop with `stopped: restart: allocation changed` and the supervisor starts the kernel again within a minute |
| resume a workflow that finished `blocked` after you answered its questions | `workflow-approve --id <w>` (with `--allow-dynamic` / `--allocation` as needed) | `resumed-after-block`: the finish is cleared, the supervisor starts a kernel |
| ship a new runtime build | `npm run build` | every running kernel notices its module changed (`build-changed`), ends cleanly and is restarted by the supervisor on the new code |
| pause a workflow | `workflow-stop --id <w>` (writes `stop.flag`) | `stopped: stop flag` at the next tick; the supervisor leaves it while the flag exists; delete the flag to let it start again |
| read a workflow | `workflow-status --id <w>` | read-only |
| clean up the worktree of a workflow that merged | `workflow-lane-close --id <w>` | `orca worktree rm --force` on the lane, branch preserved (`lane-closed`); refused while the kernel is alive or the lane is unmerged |
| merge a lane the kernel could not merge | merge it yourself in the base worktree, then `workflow-approve --id <w>` | the conflict is in `lane-merge-conflict` and in the `merge` needUser item; the kernel never force-merges into a tree it does not own |
| run a workflow from a chat, without Orca | `--host-adapter headless` on every command, or `STARCI_HOST=headless` once | one operation at a time as a headless process; a `host` needUser item names an op this host cannot run (see [Hosts](#hosts-orca-and-headless-one-chat--one-workflow)) |

One thing that looks like a defect and is not: a workflow finishes `blocked` with every gate green when
questions for the user remain - the gates say the code holds, the questions say what the owner still decides.
And one that was a defect: Orca groups agent terminals by worktree, so the ops of several workflows sharing one
worktree all hang under the first run's node in the sidebar. That is what `--lane` ends - one workflow, one
worktree, one row.

## The provider quota is probed, not guessed

The supervisor follows the build exactly as the kernels do: a rebuilt launcher (`npm run build`) is seen at the
next round, a successor is started from the same command line and this one leaves (`supervisor-rebuilt`), so no
build needs a hand restart to take effect.

Every three minutes the supervisor asks Orca for the usage windows its status bar shows (`orca account list
--json` -> `rateLimits`: Claude's five-hour session, its week and Fable's own week; Codex's week) and writes
them whole beside every store root it covers as `_local/workflows/runtime-budget.json` (`budget-probed`; a
failed probe leaves the last good file and says `budget-probe-failed`). A runtime is bound by the generic
windows of its provider (`provider:` in profiles/runtimes.yaml) and by a named window only when its profile
names it (`budgetWindow: fableWeekly`); `budgetVerdict` says whether a window is exhausted (95% and not yet
reset) and what share is left. Kernels read the file, never Orca. The allocator folds the verdict into every
pick: a runtime whose window is exhausted is blocked (`provider window exhausted until <reset>`) until the
reset, and among the ready runtimes the one with clearly more of its window left comes first - in bands of
25 points, so a few percent never reorder a role's own chain while a half-spent week does; a runtime no window
binds (a local model, an unread provider) sits in the top band. The shared-load key still comes first. When
the budget alone moved the choice the launch says so: `allocation-budgeted {op, runtime, sparedOver:[...],
remaining:{runtime:share}}`.

## Reading a workflow

A workflow has no monitor agent to ask, so the one way to know where it stands is its own files.
`execution/workflow-view.mjs` derives a single page from them - `state.json`, `events.jsonl`, `kernel.lock`,
`stop.flag`, `validator/verdicts.jsonl` and the repository's `supervisor.log` - and the launcher prints it:

```
orca-supervised-launch.mjs workflow-status --id <id> [--json true]
orca-supervised-launch.mjs workflow-list
```

`workflow-status` prints the page; `--json true` prints the machine record instead (the kernel's own status
fields, unchanged, plus the whole view under `view`). `workflow-list` prints one line per workflow of the
repository: phase, operations done, whether a kernel process is alive, how old the last event is.
`buildView({repoRoot,id,now})` is the same view as a plain object, `renderView` the page, `renderJson` the
record. The view never calls Orca, never asks a model and never writes - it does not even open a store, so
reading a workflow cannot create one - and a missing file is an empty field, never an error: a tree whose
kernel keeps no validator verdicts and no lanes still renders a complete page.

| section | what the number means |
| --- | --- |
| `kernel` | the pid in `kernel.lock` and whether that process exists, plus `silentMs`: how long ago the **last event** was appended |
| `lane` | the worktree this workflow owns, its branch, the base worktree and branch it goes home to, and the merge that took it there (null for a workflow that runs in whatever worktree it was started from). `workflow-list` carries the same row |
| `supervisor` | the last `supervisor-round` in `supervisor.log`, and what that round decided for this workflow. There is no pid to probe, so `alive` means only "a round landed in the last 5 minutes" |
| `runtimes` | `running` is counted from the operations that are actually running (saved loads may belong to a dead kernel), `max` is this workflow's `--allocation` slot count, `cooling` is the allocator's wake time |
| `ops` | the status histogram, every running op with its age since `launched`, its restarts and the last thing the log said about it (`lastPing`), and every blocked op with its refusal |
| `ledger` | `done` = `verified` + `preexisting`, `implemented`, `todo` = `planned`, `outOfRepository`, and `eligible` = the items a live op is carrying. `byFeature` groups by the first two segments of the Work node id (`<product>.<feature>`). `treeEligible`/`treeTotal` are the whole tree's numbers from `ledgerSummary`, not this workflow's |
| `reviews` | rounds per reviewed node set (`verifyRounds`) and the groups a `verify-exhausted` event has parked |
| `validator` | accepted / rejected / unavailable verdicts, from `validator/verdicts.jsonl` when the kernel keeps it and from the `validated` / `validator-rejected` / `validator-unavailable` events otherwise |
| `rate` | `op-done` events per hour and distinct nodes finished per hour over the last 3 hours - or over the workflow's whole life when it is younger than that, so a 20 minute old run never reads as idle |
| `anomalies` | `state.anomalies`: one signature per repeated oddity, its count and the triage option that settled it |
| `recent` | the last 15 events, one line each: time, seq, event and the fields that matter |

**When `kernel.silentMs` grows.** Up to one wait tick (15 min) of silence is normal: the kernel is inside
`waitTick`. Past the supervisor's health window (25 min) the supervisor itself kills and restarts the kernel,
so the honest reading is the pair: silence **and** a supervisor whose last round is recent means the restart
is already someone's job; silence with no supervisor log means nothing is watching - start
`workflow-supervise`, or run `workflow-run --id <id>` yourself. A silent kernel whose `pid` is gone and whose
`finished` is null was killed; the store is complete, so starting it again resumes the same workflow.

**When `needUser` is not empty.** Nothing else will clear those items: the policy table has already decided
it cannot. A `ledger` item wants an allowlist or checks authored on the node; a `dynamic-op` item wants
`workflow-approve --id <id> --allow-dynamic N`; `environment` and `authority` items want you. Until then the
workflow keeps running everything else and stops `blocked` at the end with those items in its final report.

The supervisor covers two store roots: the repository's own (`<repo>/.starciwork/_local/workflows`) and, when it runs from a worktree, that worktree's, because a workflow whose tree was named with `--ledger-root` keeps its store beside that tree; such a workflow is started with the same `--ledger-root`.
