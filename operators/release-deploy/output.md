# Output of `release.deploy`

The operator returns one closed envelope with `outcome` equal to `deployed`, `rolled-back`, or
`blocked`. It never emits a handoff or a free-form routing instruction.

## Deployed receipt

A `deployed` receipt contains:

- exact project, release, artifact, digest, source head, target, environment, strategy, replacement,
  authorization, manifest, intent, window, deadline, input, and progress bindings;
- the resolved credential handles, by name only;
- the declared probe identifiers;
- one record per executed step, with its state, the observed revision of its own boundary before and
  after, its statement, and its evidence;
- the monitoring series: the deadline, the elapsed time, the backoff, every observation, and the final
  condition;
- the proved steady state;
- findings, including every idempotent no-op.

## Rolled-back receipt

A `rolled-back` receipt is its own terminal outcome. It carries the rollback record naming the restored
release, its digest, the revisions before and after, the preserved data boundary, and the verification
time. It never carries a steady state for the release it rejected, and it must never be read as
successful delivery of that release.

## Blocked receipt

A blocked receipt claims no steady state. It carries one typed failure, the steps and references
involved, the owning domain, retryability, and, only when retryable, a single-use resume token with the
required material delta.

## Steps and revisions

A step either mutates a boundary or it does not.

| Kind | Steps | Revisions |
| --- | --- | --- |
| Mutating | `host-prepare`, `artifact-publish`, `migrate`, `domain-reconcile`, `rollout`, `recover`, `rollback` | Required before and after |
| Reading | `authorize`, `manifest-validate`, `plan`, `execution-root-init`, `credential-resolve`, `artifact-build`, `monitor`, `proof` | Forbidden |

Every effect is a compare-and-set. A mutating step in state `applied` must have moved its revision; a
step reporting `no-op` or `skipped` must not have. A reading step that reports a revision has invented
a fact about a boundary it never touched.

## Credentials

`credentialRefs` holds `secret-ref://` handles and nothing else. There is no field in the receipt that
accepts a credential value, so "never log the secret" is a shape rather than a discipline: a token
written where a handle belongs is rejected as malformed.

## Failure codes

| Code | Owning issue | Valid material delta |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | Corrected input. |
| `AUTHORIZATION_MISSING` | No declared grant covers this project, environment, target, or action. | The declared authorization. |
| `MANIFEST_INVALID` | The validated manifest is pinned to another release. | A manifest validated against this release. |
| `ARTIFACT_MISSING` | The immutable digest cannot be resolved. | The published artifact at that digest. |
| `CREDENTIAL_UNAVAILABLE` | A declared handle cannot be resolved through existing custody. | Restored custody, never an inline value. |
| `HOST_UNAVAILABLE` | The declared host cannot be prepared. | A reachable, prepared host. |
| `MIGRATION_BLOCKED` | The declared migration cannot be applied safely. | An approved migration boundary. |
| `DOMAIN_UNRECONCILED` | Domain or TLS state cannot be brought to the declaration. | Provider state or provider authority. |
| `ROLLOUT_FAILED` | The rollout could not place the release on the target. | A corrected target or plan. |
| `STEADY_STATE_UNPROVEN` | The window never closed before the bounded deadline. | A fresh observation series after the target recovers. |
| `CONCURRENT_DRIFT` | A release that is neither this one nor its predecessor became active. | A replan against the new observed state. |
| `RECOVERY_EXHAUSTED` | Approved reversible actions ran out. | Rollback authority, or approval for an unsafe action. |
| `ROLLBACK_IDENTITY_MISSING` | Rollback is required and its exact safe release no longer exists. | A restored safe release. |
| `APPROVAL_REQUIRED` | Destructive loss, rotation, or a new host, domain, tenant, or project. | An approval decision outside this operator. |
| `NO_PROGRESS` | A resume adds no effective delta. | Materially new authorization, manifest, credentials, or observations. |

## Cross-field invariants

- `outcome` equals `receipt.status`, and `handoff` is always `null`.
- Each step appears at most once. Mutating steps record both revisions and reading steps record
  neither; `applied` moves the revision and `no-op` or `skipped` does not.
- Any observed release that is neither the bound release nor the release it replaces forces `blocked`
  with `CONCURRENT_DRIFT`, and forbids both a recovery and a rollback in that receipt.
- Monitoring observes the bound deadline, advances in time, and reports `deadline-exceeded` when it
  runs past it. A `steady` final condition requires the last observation to be steady.
- Steady state requires monitoring, a steady final condition, an active digest equal to the bound
  digest, availability of every declared target, no superseded active target outside `blue-green`, an
  elapsed window at least as long as the bound window, and a pass from every declared probe.
- `branch: "none"` forbids a recovery and a rollback; `recover` requires a recovery; `rollback`
  requires a rollback, and a rollback record requires the rollback branch.
- A recovery requires at least two failing observations, numbers its attempts contiguously from one,
  acts only on the bound release identity, and is exhausted when every attempt failed.
- Exhausted recovery cannot end in a deployment.
- `deployed` requires a steady state, monitoring, a rollout step that did not fail, a monitor step, no
  rollback, no failure, no resume, and the declared authorization in the evidence.
- `rolled-back` requires the rollback branch, an applied rollback step, a restored release and digest
  different from the rejected ones, a moved revision, and no steady state, failure, or resume.
- `blocked` requires one typed failure and no steady state. A retryable failure requires a resume; a
  non-retryable failure forbids one.

## Practical outcomes

Deploy the production API: the host is already prepared and records a no-op, the digest is published
once, one additive migration applies, the domain is unchanged, the push to `main` moves the target from
revision 4 to 5, monitoring watches for nine minutes while boot completes, the typename probe and the
landing probe both return `200` across a five-minute window, and the receipt returns `deployed`.

Deploy the same release into a target that never recovers: two approved reversible actions are repeated
and fail, the previous release is restored from its exact digest with its data boundary preserved, and
the receipt returns `rolled-back` — a terminal outcome, never a delivery.
