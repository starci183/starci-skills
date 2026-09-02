# Output of `fe.surface.audit`

The operator returns one closed envelope with `outcome` equal to `audited` or `blocked`. It never
emits a handoff or free-form routing instruction.

## Audited receipt

An audited receipt contains:

- exact project, source, target, applied receipt, knowledge, runtime, input, and progress bindings;
- the complete bound rule inventory, which is the only vocabulary a verdict may cite;
- one capture per declared matrix entry, with its fingerprint and the exact condition it was taken
  under;
- one observation per node, property, and matrix entry, naming the measured value, the identifiers
  that node claims, and the identifiers it claims that resolve to nothing;
- findings drawn from the canonical verdict model.

The receipt records what the surface actually renders. It never repairs anything, proposes no fix, and
authorises no change.

## Observations

An observation is a measurement. It always carries `measuredValue`, because a node with no measurement
cannot be judged.

`claimedRuleIds` lists the identifiers that resolved against the bound inventory.
`unknownClaimedIdentifiers` lists the ones that did not. Filing an unpublished identifier among the
known claims would launder it into authority, and dropping it would hide it, so it gets its own field
and its own finding.

## Findings

Each finding carries one base verdict and zero or more cause tags from the canonical verdict model,
and cites the capture of the matrix entry it names.

| Class | Verdict | Rule | Unpublished claim |
| --- | --- | --- | --- |
| Claim and measurement disagree | A failure verdict with `VALUE_DRIFT` | The claimed rule | `null` |
| Value carried, nothing claimed | `PROOF_MISSING`, usually `WRONG_OWNER` | `null` | `null` |
| Claimed identifier not published | `PROOF_MISSING` | `null` | The identifier |

A verdict may cite only a rule identifier present in the bound inventory. An identifier outside it is
`UNKNOWN_RULE`, which blocks the invocation rather than producing a finding: the third finding class
reports a claim the audit read, never a rule the audit reached for.

A `VALUE_DRIFT` finding must name the rule it drifts from, and that rule must be one the node actually
claimed. Drift from a rule nobody claimed is not drift.

`PASS` carries no cause tag, and is valid only where no failure finding stands on the same node and
property. Several failed layers produce linked findings; they are never collapsed into a composite
verdict.

## Blocked receipt

A blocked receipt has no audit. It contains one typed failure, the exact matrix entries, nodes, and
references involved, the owning domain, retryability, and, only when retryable, a single-use resume
token with the required material delta.

A blocked receipt may record the applied head and the observed head as different values, because
reporting that gap is exactly what `SOURCE_DRIFT` is for.

## Failure codes

| Code | Owning issue | Valid material delta |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | Corrected input. |
| `SOURCE_DRIFT` | The observed source no longer matches the applied head. | A re-applied source, or a refreshed application receipt. |
| `RUNTIME_UNAVAILABLE` | The endpoint does not serve the bound route, or never reaches readiness. | A serving endpoint at the bound route. |
| `EVIDENCE_MISSING` | A declared matrix entry produced no capture. | The missing capture, or a corrected matrix. |
| `UNKNOWN_RULE` | The audit reached for an identifier outside the bound inventory. | The topic that publishes it, or a corrected identifier. |
| `NO_PROGRESS` | A resume adds no effective delta. | Materially new knowledge, applied source, matrix, or runtime. |

`RUNTIME_UNAVAILABLE` is owned by whoever runs the service, not by the frontend under audit. This
operator never starts, stops, or reconfigures one.

## Cross-field invariants

- `outcome="audited"` requires `receipt.status="audited"`, non-null `audit`, null `failure`, and null
  `resume`.
- `outcome="blocked"` requires `receipt.status="blocked"`, null `audit`, and non-null `failure`. A
  retryable failure requires a resume; a non-retryable failure forbids one.
- An audited surface is measured at the applied source head.
- `boundRuleIds` does not repeat an identifier.
- Each matrix entry produces at most one capture, and every capture is registered in `artifactRefs`.
- Every observation and every finding names a matrix entry that produced a capture.
- Every finding cites the evidence reference of the capture for its own matrix entry.
- Every node measures each property at most once per matrix entry.
- Every finding judges a node and property that were measured.
- Every claimed rule identifier recorded as known is present in the bound inventory, and every
  unpublished claimed identifier is absent from it.
- Every unpublished claimed identifier carries a finding that names it.
- Every measured value with no claim at all carries a `PROOF_MISSING` finding.
- Every finding that cites a rule cites one present in the bound inventory.
- A finding reporting an unpublished claim cites no rule and carries verdict `PROOF_MISSING`.
- A `VALUE_DRIFT` finding names a rule the node claimed.
- `PASS` carries no cause tag and never stands beside a failure finding on the same node and property.
- `handoff` is always `null`.

## Practical outcomes

Audit a dashboard surface across two conditions: the section stack measures the value its claimed rule
declares and is recorded `PASS`; the page region stack claims the same rule at both widths but renders
one step lower on the narrow viewport, producing an `APP_OVERRIDE` finding tagged `VALUE_DRIFT` and
`STATE_OR_VIEWPORT_DRIFT`; an aside renders an inset that no contract claims, producing a
`PROOF_MISSING` finding tagged `WRONG_OWNER`; and one node claims an identifier the published
knowledge does not contain, producing a `PROOF_MISSING` finding that names that identifier and cites
no rule.

Audit a surface whose runtime never serves the route: the invocation returns `RUNTIME_UNAVAILABLE`, no
capture is taken, and no verdict is recorded anywhere.
