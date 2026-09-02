# Output of `uat.verify`

The operator returns one closed envelope with `outcome` equal to `passed`, `failed`, or `blocked`. It
never emits a handoff or a free-form routing instruction.

## Decided receipt

A `passed` or `failed` receipt contains:

- exact project, backend source, source head, feature, flow, run, protocol, template, runtime,
  admission, input, and progress bindings;
- the freeze: the canonical snapshot reference, its content fingerprint, the freeze time, the fixture
  namespace, the non-secret identity record, and the frozen cases with their required checkpoints;
- the publication: the canonical result reference, its content fingerprint, the snapshot fingerprint
  it binds, and the published verdict;
- one independent verdict per lane for Behavior, UX, and UI;
- one result per frozen case, with its execution time, its captures, and whether any post-journey
  mutation touched the run;
- the scoped cleanup record and every finding.

A blocked receipt publishes nothing. It carries one typed failure, the exact cases and references
involved, the owning domain, retryability, and, only when retryable, a single-use resume token with
the required material delta.

## The account record cannot hold a secret

The identity record frozen into the snapshot is closed and every field is constrained:

| Field | Shape |
| --- | --- |
| `accountRef` | `account://fresh/...` |
| `provisioningMode` | the constant `control-panel-auto-create` |
| `provisioningOwnerRef` | `control-panel://...` |
| `identityRecordRef` | `keycloak-user://...` |
| `applicationRecordRef` | `database-user://...` |
| `principalFingerprint` | a `sha256:` fingerprint |
| `fixtureNamespace` | a `uat-` prefixed namespace |
| `credentialCustody` | the constant `control-panel-ephemeral` |
| `state` | the constant `authenticated` |

There is no free-form string anywhere in the record and no additional property is accepted, so a
password, cookie, token, or OTP cannot be placed there. The rule is enforced by shape rather than by
review, which is why an added `password` field is rejected as an invalid record rather than flagged as
a finding.

## Verdicts

| Outcome | Meaning | Publication |
| --- | --- | --- |
| `passed` | Every frozen case passed and all three lanes agree. | `result.json` published |
| `failed` | At least one lane contradicts the frozen expectation. | `result.json` published |
| `blocked` | Runtime, evidence, provisioning, or canonical write authority was unavailable. | Nothing published |

A contradiction is a `FAIL`, and unavailability is a `BLOCKED`. The two are never traded for each
other: charging unavailability as a failure blames a product nobody observed, and narrating a
contradiction as a block hides a real defect.

## Blocked receipt

A blocked receipt carries the same `binding` and `freeze`, `publication: null`, the lanes and case
results that were reached with `unavailable` where the runtime stopped answering, one typed failure
naming the unavailable subject, and a resume when the failure is retryable. Nothing is published:
unavailability is never charged to the product as a failure.

## Failure codes

| Code | Owning issue | Valid material delta |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | Corrected input. |
| `SOURCE_DRIFT` | The observed backend head no longer matches the frozen head. | Refreshed source binding. |
| `ADMISSION_MISSING` | The blind visual PASS or the final quality PASS is absent. | The missing admitting receipt. |
| `PROVISIONING_UNAVAILABLE` | The control plane cannot create or authenticate the run-scoped identity. | Restored provisioning, never a user sign-in. |
| `LEASE_INVALID` | The lease is expired, foreign, unauthenticated, or bound to another principal. | A reacquired lease. |
| `RUNTIME_UNAVAILABLE` | The declared runtime owner is not ready or its origin disagrees. | A ready owner from the runtime task. |
| `EVIDENCE_UNAVAILABLE` | A lane produced no evidence to judge. | The restored dependency and a rerun of the frozen case. |
| `FIXTURE_VIOLATION` | Preflight, namespace, or cleanup scope could not be satisfied. | A corrected fixture boundary. |
| `CANONICAL_WRITE_DENIED` | The canonical pair cannot be written and reparsed under the routed Source. | Restored write authority on the routed backend Source. |
| `NO_PROGRESS` | A resume adds no effective delta. | Materially new admission, lease, evidence, or cases. |

`REQUIRE_USER_ACTION` is deliberately absent from this list. Routine local UAT authentication is
auto-provisioned or blocked; it is never a request.

## Cross-field invariants

- `outcome` equals `receipt.status`.
- `passed` and `failed` require a publication, a null failure, and a null resume; the published verdict
  equals the outcome.
- `blocked` requires a null publication and one typed failure. A retryable failure requires a resume; a
  non-retryable failure forbids one.
- A publication requires a freeze, binds that freeze's snapshot fingerprint, and addresses the same
  canonical feature and flow directory.
- The canonical snapshot path equals the bound feature and flow, and `artifactRefs` registers both
  canonical files.
- A decided receipt carries exactly one verdict for each of Behavior, UX, and UI.
- Any lane verdict of `fail` forces `failed`; any lane verdict of `unavailable` forces `blocked`.
- `passed` requires every lane to pass and every frozen case to pass.
- Every case result names a frozen case, keeps its frozen order, and executes strictly after the
  freeze.
- Case executions are strictly ordered in time, because one authenticated lease acts at a time.
- A case whose run recorded a post-journey mutation cannot pass.
- Every capture names an assertion, and every required checkpoint on a passing case is covered by a
  full-viewport capture.
- `passed` requires performed cleanup selecting on `is_uat=true` and the exact frozen namespace.
- `passed` forbids an open hard finding and requires both admitting receipts in the evidence.
- `handoff` is always `null`.

## Practical outcomes

Verify a paid enrollment flow: two frozen cases execute in order after the freeze, entry, commitment,
feedback, recovery, and terminal checkpoints each carry a full-viewport capture paired with runtime
evidence, all three lanes pass, cleanup removes only the run's `is_uat` records, and `result.json`
publishes `passed` bound to the snapshot fingerprint.

Verify the same flow while the payment sandbox is down: the decline case produces no runtime evidence,
the UX lane is `unavailable`, nothing is published, and the receipt returns `EVIDENCE_UNAVAILABLE`
with a resume that names the exact restored dependency.
