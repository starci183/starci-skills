# Scoped technical approval on a manual Plan

Use this only when the actual user explicitly delegates technical approval to a named coordinator for a bounded delivery. Observing other tasks does not confer approval authority. A runtime maintenance request does not delegate product execution.

The mandate and the decision are different facts: the user grants a role; the coordinator later reviews a concrete Plan, goal or result. Record the latter as `actor: assistant`. Do not fabricate `actor: user` approvals, infer an auto budget, change execution mode or install a scheduler.

The coordinator owns Plan sequencing, goal approve/reject decisions, dependency and
ownership conflicts, task-level progress and expected-versus-actual acceptance.
The executor owns implementation and its internal repair loop. Follow
[the coordinator boundary](workflow-delivery-boundary.md#coordinator-owns-decisions-executor-owns-delivery)
for quiet waits, exception handling and authorized runtime improvement. The APIs
below record boundary decisions; they do not require supervision of every command.

## Honest conversation provenance

User grant, coordinator review and actual task presentation use this shape:

```yaml
actor: user # assistant for the actual coordinator review or goal presentation
threadId: <actual source thread>
messageId: null
messageIdAvailability: not-exposed
quote: <exact actual text observed in the conversation>
assurance: conversation-context-not-authenticated
```

When a native message ID is exposed, preserve it and use `messageIdAvailability: available`. A returned task ID, completed turn ID, local record ID or content hash is not a native message ID. Preserve such context in the actual explanation, not by mislabeling it. The source conversation supplies authority; these local records cannot authenticate a user, detect a dishonest quote or sandbox a malicious caller. Hashes detect changed bytes, not truth.

## Target readiness before approval

Before freezing or approving an effectful workflow goal, inspect its actual target state, eligibility, blockers and current declared inputs through `validateWorkspace`. A valid workspace and completed SRS/SDS do not imply that an imported implementation leaf is ready. Read its semantic scope too: an obsolete implementation map or invented architectural obligation must not become the expectation merely because it is already on disk.

For an imported `uninvestigate` consumer whose scope needs confirmation or correction, select a bounded `prepare-work` / `prepare` scope revision under actual authority before implementation. Reuse the existing workspace and bindings; revise only the selected incomplete leaf's purpose, accepted design mapping and meaningful assertions. Keep correct dependency edges and explicitly review any necessary graph change. Set it to `todo` only after the scope is genuinely confirmed; do not mark implementation done or copy a new digest into old proof to clear the gate. Fresh confirmed `todo` needs no investigation receipt. Already-ready nodes do not acquire an extra preparation workflow.

Separate preparation's completion target from its write scope. The setup/scope-review leaf is the sole preparation `workTargets` completion target, using the prepare operation's business profile. A future implementation leaf is an explicitly authorized path/resource write target that remains `todo` without completion. Name both roles in the goal and typed input. Never use the future implementation leaf as a setup completion target: `markWorkDone` correctly requires proof for every exact selected completion target. Create or reuse only the bounded setup leaf needed for this revision, not a new workspace or a product-wide setup tree. Preparation review proves scope readiness, not code, backend E2E or UAT.

After the scope revision, read back eligibility and current inputs, then present/review the affected implementation checkpoint before first dispatch. Preserve prior approvals honestly; changed goals or effect ceilings require renewed review, not retroactive receipts. Preparation is not a way around missing business decisions or unfinished required designs. The default gate continues to reject undeclared `uninvestigate` consumer dispatch.

Match Work target granularity to bounded acceptance: cohesive implementation child leaves can complete separately while their parent aggregates them. Do not mark the whole parent done from one partial workflow or enlarge a workflow solely to fit an oversized leaf; use only the decomposition the actual scope needs.

## API and bounded review

The APIs are in `workflows/delegation.mjs` and `workflows/lifecycle.mjs`. All example field names below describe a contract, not real product approval.

1. After observing the actual grant and reviewing the complete Plan, call `registerScopedMandate(plan, options)`. Options contain a unique local `id`, actual user `source`, `coordinatorThreadId`, executing `taskThreadId`, absolute `workRoot` and `repositories`, actual coordinator `review` provenance and one ceiling per exact Plan job. It returns `{file, digest}`. Never overwrite a mandate or reactivate a revoked record.
2. Each job ceiling contains `id`, `environment` (`local` or `isolated-test`), `business` and exact `resourceEffects`. Each effect has `target`, `operation`, `postcondition` and a checked category: `work-record`, `isolated-test` or `local-artifact`. Classification must match the real effect; attaching an isolated-test label to a live service does not make it isolated. Paths, criteria and Work targets come from the exact reviewed Plan, not a new file inventory.
3. `presentDelegatedGoal(run, {scope, jobId, reference, provenance})` binds the actual brief shown in the executing task. Keep the full goal and readable document linked. It grants no effects.
4. `authorizeDelegatedGoal(run, {reference, assessment, source, priorRuns})` records the coordinator's actual review. `assessment` contains `stage: goal`, `contextDigest: delegatedContext(run)`, `risk: low|medium`, matching `environment`, `reversible: true`, a concrete `reason`, nonempty `observations` and empty unresolved `hazards`. Unknown risk stops; do not fill these fields without inspection.
5. The executing workflow runner calls `requestCell(run, cellId, {coordinatorThreadId, taskThreadId, assessment, priorRuns})` for each new cell. Reassess current context with `stage: cellId`; earlier assessment is not a reusable blank cheque. This is an internal currentness/risk check under the existing goal approval, not another Plan-coordinator approval or request for a message. Preserve the actual mandate identities; never invent a coordinator conversation review for a cell check. A changed scope, unresolved hazard or missing authority escalates before effects. Normal typed response and artifact checks remain unchanged.
6. Present actual outputs. Use `acceptDelegatedDelivery(run, {source, assessment, priorRuns})` with `stage: acceptance`, current context and the actual coordinator review. Complete only exact selected leaves through normal completion preflight and `markWorkDone`. Never substitute “agent said done” for actual proof.
7. `saveRun` retains the same four-file bundle. `loadPlanRuns(plan, workRoot)` reconstructs it with original presentation provenance and rejects inconsistent bindings. For all-jobs-done delegated Plans, state is `awaiting-terminal-review`; use `saveDelegatedCompletion(plan, {reference, criteria, source})` only after inspecting every terminal criterion and named producer. It persists completion and closes the mandate.

### Technical questions at later workflow checkpoints

A reviewed job ceiling may optionally contain `technicalQuestions: [<exact job.openQuestions string>]`. This is an explicit coordinator classification within the actual user's technical delegation, not an inference from an untyped question or an answer being present. Each listed question must belong to that exact job and occur once. Omission (including historical mandates) means no question-answering authority; Plan-wide questions and unlisted job questions remain blocked.

Freeze the question identities with the original mandate and its actual coordinator `review` provenance. Do not guess future source hashes, fixture paths or other answers just to register a full Plan. At that later workflow, inspect the facts and put exactly one `{question, answer}` pair for every job question in `goal.inputs.planQuestionAnswers` before proposing and presenting the goal. Questions must match exactly; answers must be nonempty strings. Missing, duplicate, foreign or extra pairs fail validation. The actual coordinator then reviews those answers through the ordinary digest-bound goal decision. Changing an answer after presentation requires a newly proposed/presented goal and fresh decision; it cannot reuse prior approval. This permits successive workflows under the same unchanged mandate without prematurely freezing unknown answers.

Classification does not authorize a new product policy, business choice or expanded effect. Use it for technical resolution already inside the reviewed business/path/resource ceilings—for example, selecting the actual disposable fixture within the existing isolated-test scope. If resolving the question requires different scope or a user decision, stop at that checkpoint. Never label an unresolved product decision technical to clear a gate. The runtime checks exact membership, coverage and immutable bindings; it cannot authenticate the conversation or judge whether an authored classification or answer is truthful. Direct manual user approval and auto's user-question gates are unchanged.

Adoption can start between workflows: preserve earlier valid direct-user goal/result receipts unchanged. Terminal review accepts those exact currently verified predecessors or decisions under this same mandate, never a different coordinator mandate or invented replacement receipts. Current producer checks compare semantic Work bindings and prerequisite state; a `done` producer additionally needs current effective Work completion. Corrupt completion proof cannot qualify merely because its semantic hash stayed the same. Unrelated stale Work is not itself a reason to invalidate a correctly isolated producer.

For an authorized design revision, freeze the explicit authored-output policy
described in [Work verification](work-verification.md) on the presented goal.
Coordinator approval does not implicitly enable it. The runtime seals new target
content separately from immutable inputs; coordinator review accepts that actual
result, never a rewritten request binding. Manual, auto and scoped coordinator
paths share these currentness checks. A stale intermediate import still needs
its own bounded review; completing the selected output cannot accept another
owner's node. Preserve historical runs for inspection and use a fresh checkpoint
when an old strict request cannot represent the intended revision.

`revokeScopedMandate(plan, reference, {source})` records an actual user revocation. State is reread before new effects, acceptance and Work completion. Historical accepted proof remains inspectable after closure/revocation; this never grants new execution authority. An interrupted terminal save is not permission to reactivate the mandate: inspect the same bundle and reconcile its actual completion before retrying.

## Boundaries preserved

Manual without an explicit mandate still requires actual subsequent user approval. Auto retains its own later user approval and explicit budget. Never combine the two authorities or insert a user-shaped fallback into a delegated run.

Every new action stays within exact Plan, job, task, repository/Work realpaths and effect ceilings. Current user questions, stale upstream Work, changed source anchors before first implementation dispatch, changed producer artifacts, invalid typed output or missing completion proof still block. No module mandate authorizes publishing, deploying, live correction/payment/messaging, migration or modifying `.claude`/bootstrap files. Those need separate actual authority and workflows.

UI drawings, implemented FE captures and UAT recordings remain distinct required outputs when applicable. Coordinator technical acceptance is not a claim that a human performed or accepted UAT.

The generic Plan renderer describes a proposal and does not load live approval state. Report actual validated mandate/goal/result state separately; do not call a recorded delegation “waiting for the user” merely because a proposal document has no lifecycle context.
