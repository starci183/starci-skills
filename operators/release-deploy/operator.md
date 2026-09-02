# release.deploy

## Job

Deploy one immutable release to one declared target under its declared authorization and prove the
steady state it reached, taking the recovery or rollback branch inside the same pass rather than
assuming the rollout succeeded.

## Recovery and rollback are branches of this job

A rollout that does not stabilize is still this operator's problem. The run ends on one of three
terminals and never in the middle: the release is deployed, the previous release is restored, or the
work is blocked with an exact reason. A restored release is its own terminal outcome; it must never
be read as successful delivery of the release it rejected.

## The release is immutable and exact

A release is identified by its `sha256:` digest, not by a tag, a branch, or a build number. The
artifact is never rebuilt, retagged, or substituted inside this pass; if the digest cannot be
resolved the run blocks rather than building a replacement and calling it the same release. The
manifest must have been validated against exactly this release, because a manifest pinned to another
release is how an unreviewed image reaches a reviewed target.

## Authorization is declared, never implied

Deployment requires its own declared grant covering this project, this environment, this target and
the `deploy` action, still valid at the moment the target was observed. No ordinary task, no
precedent from a sibling project and no urgency implies it, and an unauthorized deployment does not
become authorized by being useful. Destructive loss, a credential rotation, or a new host, domain,
tenant or project leaves this operator's authority entirely and returns `APPROVAL_REQUIRED`.

## Credentials are names, never values

Handles are resolved through existing custody at the moment they are needed. A resolved value never
enters the plan, the manifest, the receipt, a log line, a command argument, or a message. The receipt
records which handles were resolved and nothing more, and no field in the contract can hold a value
even if someone tried: a token written where a `secret-ref://` handle belongs is rejected as
malformed rather than quietly carried into an argument list.

## Every effect is a compare-and-set

A step either mutates a boundary or it does not. The mutating steps are `host-prepare`,
`artifact-publish`, `migrate`, `domain-reconcile`, `rollout`, `recover` and `rollback`, and each
records the observed revision of its own boundary before and after. A desired state that already
matches is a proved idempotent no-op and is recorded as one; claiming an application without moving
a revision is refused, and a reading step that reports a revision has invented a fact about a
boundary it never touched. The execution root is ignored and rebuildable.

## Monitoring distinguishes progressing from failing

On this project a push to `main` triggers the workflow and boot takes roughly eight to nine minutes,
so `progressing` is the expected condition for most of the window and is never treated as a failure,
and a monitoring deadline shorter than the window it must contain produces a guaranteed false
failure. One transient probe never becomes recovery: a failing condition has to persist across at
least two observations. A release that is neither this release nor the one it replaces stops the run
as `CONCURRENT_DRIFT` and forces a replan; it is never recovered or rolled back as though it
belonged here. Recovery repeats only approved reversible actions, numbers its attempts contiguously
from one, preserves the same release identity, and cannot end in a deployment once exhausted.
Rollback is valid only when the exact safe release still exists, the current data and schema state
remain compatible with it, and the revision actually moved.

## Steady state is proved, not assumed

A rollout that returned without an error is not a deployment. Steady means the immutable digest is
active, every declared target is available, no superseded target remains active unless the strategy
permits it, the window elapsed in full, and every declared probe passed across the whole of it. That
is what turns three silent failures into detectable ones: the workflow finished while the old digest
is still serving traffic; one of two targets never came back and the other absorbed the load; the
readiness probe passed once, at the one moment it happened to be asked. At least one declared probe
is public, because a run observing only container health proves nothing a user could see; here the
GraphQL typename probe returning `200` is the readiness signal.

## The two fallbacks are ordered, and the rest terminate

A failed rollout is not the end of the run, it is the entry to the first fallback: `ROLLOUT_FAILED`
takes the recovery branch, which repeats only approved reversible actions against the same release
identity. When those run out, `RECOVERY_EXHAUSTED` takes the second fallback: rollback to
`rollbackIdentity` by its exact digest. Both are recorded under `## Fallbacks taken`, because a
branch taken silently is a branch nobody can audit. After that there is nothing left to try, so
`ROLLBACK_IDENTITY_MISSING`, `STEADY_STATE_UNPROVEN` and `CONCURRENT_DRIFT` terminate: a rollback
without its safe release, a window that never closed, and a foreign release that appeared mid-run are
each a state this operator must not act further on.

## Deadlines and probes have defaults, approval does not

`steadyDeadline` defaults to 600 seconds because that is the boot time this project actually shows,
and `probes` default to the set the validated manifest declares, so a person who names neither is
still measured against something real. `approval` has no default at all: changing what production
serves is always something a person said yes to.

## Boundary

Context is read-only apart from the declared mutations. The operator applies only the declared host,
migration, domain and rollout mutations against the frozen release identity, restores the exact
declared rollback release when that branch is taken, and writes only `response/` of its own branch:
`data/probes.json`, `response.md` and `response.json`. It does not log, persist, echo, or return a
resolved credential value; does not deploy a release the declared authorization does not cover; does
not rebuild, retag, or otherwise alter the immutable artifact identified by the frozen digest; does
not edit the intent or revalidate the manifest into something else; does not recover or roll back a
release that appeared during execution and does not belong to this run; does not report a rolled-back
run as successful delivery of the rejected release; and does not declare steady state from a single
probe observation or from an assumed rollout.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@remote/ghcr/<image>` | the immutable image by digest; a tag is never a binding | yes |
| `@workspaces/device-state` | credential handles by name and their custody; values never appear | yes |
| `@remote/github-actions/<runId>` | CI evidence of the build and the rollout, read only | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `quality-verification` | `quality.verify`; verification precedes an immutable build, and it is the authorization this run stands on | yes |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `release` | id | — | The immutable release identity being deployed, with the `sha256:` digest that identifies it |
| `target` | id | — | The one target this deployment may change, and the environment it sits in |
| `approval` | id | — | The declared deploy grant covering this project, environment and target; changing what production serves always needs a person |
| `probes` | list of `{probeId, kind, endpointRef, expectStatus}` | the probes the validated manifest declares | What steady state is measured by; at least one probe is public |
| `steadyDeadline` | number | 600 | The bounded monitoring deadline in seconds, measured against the boot time this project shows |
| `rollbackIdentity` | `{releaseId, artifactRef, digest, dataCompatible}` | — | The exact safe release the rollback fallback restores, by digest |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate, the authorization the input carries, and the resume | `resume` | `request/request.json`, input `quality-verification` as the authorization this run stands on | — | `INVALID_INPUT`, `AUTHORIZATION_MISSING`, `NO_PROGRESS` |
| 2 | Bind the release and compile the plan | `release`, `target`, `approval` | @remote/ghcr/<image> at the frozen digest, @remote/github-actions/<runId> for the observed state | — | `MANIFEST_INVALID`, `APPROVAL_REQUIRED` |
| 3 | Initialize the execution root and resolve the credentials by name | — | @workspaces/device-state for the declared handles and their custody | — | `CREDENTIAL_UNAVAILABLE` |
| 4 | Prepare the host, publish the artifact by digest, migrate and reconcile the domain | — | @remote/ghcr/<image> for the artifact by digest, @remote/github-actions/<runId> for each boundary's revision before and after | — | `HOST_UNAVAILABLE`, `ARTIFACT_MISSING`, `MIGRATION_BLOCKED`, `DOMAIN_UNRECONCILED` |
| 5 | Roll out | — | @remote/ghcr/<image> for the target revision before and after | — | `ROLLOUT_FAILED` |
| 6 | Monitor within the deadline, with backoff | `steadyDeadline`, `probes` | @remote/github-actions/<runId> for the probe observations across the window | `response/data/probes.json` | — |
| 7 | Detect concurrent drift before acting | — | `response/data/probes.json`, @remote/ghcr/<image> for the active release by digest | — | `CONCURRENT_DRIFT` |
| 8 | Take the recovery branch when the failure persists | — | `response/data/probes.json`, @remote/ghcr/<image> at the same release identity | — | `RECOVERY_EXHAUSTED` |
| 9 | Take the rollback branch when recovery cannot hold | `rollbackIdentity` | @remote/ghcr/<image> at the exact safe digest | — | `ROLLBACK_IDENTITY_MISSING` |
| 10 | Prove the steady state, write the receipt and emit | — | everything above | `response/response.md`, `response/response.json` | `STEADY_STATE_UNPROVEN` |

Steps 8 and 9 are the two fallbacks in order, not a sequence every run walks: a run enters step 8
only under `ROLLOUT_FAILED` and step 9 only under `RECOVERY_EXHAUSTED`, and a run that took neither
records the branch as `none`. A resume begins again at validation, reuses only unchanged fingerprinted
observations, and keeps the same release identity, because a different release is a different
deployment; a resume that adds no authorization, manifest, credential or observation change is
`NO_PROGRESS`.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `release-deployment` | `response/response.md` | md | yes |
| `probes` | `response/data/probes.json` | data | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `NO_PROGRESS` | terminate |
| `AUTHORIZATION_MISSING` | terminate |
| `MANIFEST_INVALID` | terminate |
| `APPROVAL_REQUIRED` | terminate |
| `CREDENTIAL_UNAVAILABLE` | terminate |
| `HOST_UNAVAILABLE` | terminate |
| `ARTIFACT_MISSING` | terminate |
| `MIGRATION_BLOCKED` | terminate |
| `DOMAIN_UNRECONCILED` | terminate |
| `ROLLOUT_FAILED` | fallback |
| `RECOVERY_EXHAUSTED` | fallback |
| `CONCURRENT_DRIFT` | terminate |
| `ROLLBACK_IDENTITY_MISSING` | terminate |
| `STEADY_STATE_UNPROVEN` | terminate |

## Next

| When | Operator |
| --- | --- |
| the host, the artifact registry, the credential custody or the safe release needs a shared runtime change | `platform.operate` |
