# Scoped technical approval on a manual Plan

Use this only when the actual user explicitly delegates technical approval to a named coordinator for a bounded delivery. Observing other tasks does not confer approval authority. A runtime maintenance request does not delegate product execution.

The mandate and the decision are different facts: the user grants a role; the coordinator later reviews a concrete Plan, goal or result. Record the latter as `actor: assistant`. Do not fabricate `actor: user` approvals, infer an auto budget, change execution mode or install a scheduler.

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

## API and bounded review

The APIs are in `workflows/delegation.mjs` and `workflows/lifecycle.mjs`. All example field names below describe a contract, not real product approval.

1. After observing the actual grant and reviewing the complete Plan, call `registerScopedMandate(plan, options)`. Options contain a unique local `id`, actual user `source`, `coordinatorThreadId`, executing `taskThreadId`, absolute `workRoot` and `repositories`, actual coordinator `review` provenance and one ceiling per exact Plan job. It returns `{file, digest}`. Never overwrite a mandate or reactivate a revoked record.
2. Each job ceiling contains `id`, `environment` (`local` or `isolated-test`), `business` and exact `resourceEffects`. Each effect has `target`, `operation`, `postcondition` and a checked category: `work-record`, `isolated-test` or `local-artifact`. Classification must match the real effect; attaching an isolated-test label to a live service does not make it isolated. Paths, criteria and Work targets come from the exact reviewed Plan, not a new file inventory.
3. `presentDelegatedGoal(run, {scope, jobId, reference, provenance})` binds the actual brief shown in the executing task. Keep the full goal and readable document linked. It grants no effects.
4. `authorizeDelegatedGoal(run, {reference, assessment, source, priorRuns})` records the coordinator's actual review. `assessment` contains `stage: goal`, `contextDigest: delegatedContext(run)`, `risk: low|medium`, matching `environment`, `reversible: true`, a concrete `reason`, nonempty `observations` and empty unresolved `hazards`. Unknown risk stops; do not fill these fields without inspection.
5. At each new cell, call `requestCell(run, cellId, {coordinatorThreadId, taskThreadId, assessment, priorRuns})`. Reassess current context with `stage: cellId`; earlier assessment is not a reusable blank cheque. The request retains the scoped review. Normal typed response and artifact checks remain unchanged.
6. Present actual outputs. Use `acceptDelegatedDelivery(run, {source, assessment, priorRuns})` with `stage: acceptance`, current context and the actual coordinator review. Complete only exact selected leaves through normal completion preflight and `markWorkDone`. Never substitute “agent said done” for actual proof.
7. `saveRun` retains the same four-file bundle. `loadPlanRuns(plan, workRoot)` reconstructs it with original presentation provenance and rejects inconsistent bindings. For all-jobs-done delegated Plans, state is `awaiting-terminal-review`; use `saveDelegatedCompletion(plan, {reference, criteria, source})` only after inspecting every terminal criterion and named producer. It persists completion and closes the mandate.

Adoption can start between workflows: preserve earlier valid direct-user goal/result receipts unchanged. Terminal review accepts those exact currently verified predecessors or decisions under this same mandate, never a different coordinator mandate or invented replacement receipts. Current producer checks compare semantic Work bindings and prerequisite state; a `done` producer additionally needs current effective Work completion. Corrupt completion proof cannot qualify merely because its semantic hash stayed the same. Unrelated stale Work is not itself a reason to invalidate a correctly isolated producer.

`revokeScopedMandate(plan, reference, {source})` records an actual user revocation. State is reread before new effects, acceptance and Work completion. Historical accepted proof remains inspectable after closure/revocation; this never grants new execution authority. An interrupted terminal save is not permission to reactivate the mandate: inspect the same bundle and reconcile its actual completion before retrying.

## Boundaries preserved

Manual without an explicit mandate still requires actual subsequent user approval. Auto retains its own later user approval and explicit budget. Never combine the two authorities or insert a user-shaped fallback into a delegated run.

Every new action stays within exact Plan, job, task, repository/Work realpaths and effect ceilings. Current user questions, stale upstream Work, changed source anchors before first implementation dispatch, changed producer artifacts, invalid typed output or missing completion proof still block. No module mandate authorizes publishing, deploying, live correction/payment/messaging, migration or modifying `.claude`/bootstrap files. Those need separate actual authority and workflows.

UI drawings, implemented FE captures and UAT recordings remain distinct required outputs when applicable. Coordinator technical acceptance is not a claim that a human performed or accepted UAT.

The generic Plan renderer describes a proposal and does not load live approval state. Report actual validated mandate/goal/result state separately; do not call a recorded delegation “waiting for the user” merely because a proposal document has no lifecycle context.
