# Execute `release.deploy`

## Single job

Deploy one immutable release to one declared target and prove the steady state it reached. This is one
linear operator invocation. It does not call another operator, route a workflow, pause internally, or
return a free-form control instruction.

Recovery and rollback are branches of this job, not separate jobs. A rollout that does not stabilize is
still this operator's problem, and the run ends on one of three terminals: the release is deployed, the
previous release is restored, or the work is blocked with an exact reason.

## The release is immutable and exact

A release is identified by its `sha256:` digest, not by a tag, a branch, or a build number. The
artifact is never rebuilt, retagged, or substituted inside this pass. If the digest cannot be resolved,
the run blocks; it does not build a replacement and call it the same release.

The manifest must have been validated against exactly this release. A manifest pinned to another
release cannot authorize this one, because that substitution is how an unreviewed image reaches a
reviewed target.

## Authorization is declared, never implied

Deployment requires its own declared grant covering this project, this environment, this target, and
the `deploy` action, still valid when the target was observed. No ordinary task, no precedent from a
sibling project, and no urgency implies it.

Destructive loss, a credential rotation, or a new host, domain, tenant, or project leaves this
operator's authority entirely and returns `APPROVAL_REQUIRED`.

## Credentials are resolved, never recorded

Handles are resolved through existing custody at the moment they are needed. A resolved value never
enters the plan, the manifest, the receipt, a log line, a command argument, or a chat message. The
receipt records which handles were resolved and nothing more, and no field in the contract can hold a
value even if someone tried.

## Execution sequence

1. **Validate input and resume.** Apply `input.schema.json` and semantic validation. Reject a foreign
   or expired authorization, a manifest pinned elsewhere, an observation of another target, a
   replacement identity that disagrees with the observed active release, a deadline that cannot contain
   its window, a rollback identity equal to the release, and an unchanged resume.
2. **Bind the release and the plan.** Compile the declared intent and the observed state into the plan
   this pass will execute. Every effect is a compare-and-set against the frozen release, the frozen
   target, and the observed revision.
3. **Initialize the execution root and resolve credentials.** The execution root is ignored and
   rebuildable. Credentials resolve by name; nothing is written down.
4. **Prepare the host, publish the artifact, migrate, and reconcile the domain.** Each of these owns a
   boundary and records that boundary's observed revision before and after. A desired state that
   already matches is a proved idempotent no-op and is recorded as one; claiming an application without
   moving a revision is rejected.
5. **Roll out.** On this project a push to `main` triggers the GitHub Actions workflow. The rollout step
   records the target revision before and after.
6. **Monitor under a bounded deadline and backoff.** Observation distinguishes `progressing` from
   failing. Boot takes roughly eight to nine minutes here, so `progressing` is the expected condition
   for most of the window and is never treated as failure. One transient probe never converts into
   recovery; a failing condition has to persist across observations.
7. **Detect concurrent drift before acting.** If a release appears that is neither this release nor the
   one it replaces, the run stops and replans. It is never recovered or rolled back as though it
   belonged here.
8. **Take the recovery branch when the failure persists.** Recovery repeats only approved reversible
   actions and preserves the same release identity. Exhaustion, an unsafe action, a changed boundary, or
   an unavailable rollback identity leaves recovery for approval, rollback, or blocked.
9. **Take the rollback branch when recovery cannot hold.** Rollback is valid only when the exact safe
   release still exists, the current data and schema state remain compatible, and every provider or
   runtime mutation records a before and after revision.
10. **Prove the steady state and stop.** Steady means the immutable digest is active, every declared
    target is available, no superseded target remains active unless the strategy permits it, and every
    declared probe passed for the whole window. Write the receipt under
    `input.project.artifactRootRef`, emit one output conforming to `output.schema.json`, and stop.

## Steady state is proved, not assumed

A rollout that returned without an error is not a deployment. The distinction is enforced: a `deployed`
outcome requires monitoring evidence, a final steady condition, an active digest equal to the deployed
digest, full target availability, and a pass from every declared probe across the whole window.

That is what turns three silent failures into detectable ones:

- the workflow finished while the old digest is still serving traffic;
- one of two targets never came back and the other absorbed the load;
- the readiness probe passed once, at the one moment it happened to be asked.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes the
exact delta. A resume that adds no authorization, manifest, credential, or observation change returns
`NO_PROGRESS`. A resumed run keeps the same release identity; a different release is a different
deployment.

## Mandatory attacks

The operator cannot report a deployment while any applicable item remains unresolved:

- a step claims an application without moving its boundary's revision, or reports a revision for a
  boundary it only read;
- the active digest at the end is not the digest this run deployed;
- a declared probe never passed inside the window, or the window never elapsed;
- a superseded target is still active under a strategy that forbids it;
- recovery was entered on a single failing observation, or acted on another release identity;
- a foreign release was observed and the run continued anyway;
- a rolled-back run is reported as delivery of the release it rejected.
