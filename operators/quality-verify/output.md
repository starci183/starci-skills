# Output of `quality.verify`

The operator returns one closed envelope with `outcome` equal to `verified` or `blocked`. It never
emits a handoff or free-form routing instruction.

`verified` means a verdict was reached, not that the verdict was green. A red receipt is a complete
invocation; `blocked` is reserved for the cases where no honest verdict exists at all.

## Verified receipt

A verified receipt contains:

- exact project, source, delivery, predecessor, gate plan, input, and progress bindings;
- the planned and required gates, restated so the receipt can be read without the input beside it;
- one result per planned gate, with its command, exit code, evidence, and classification;
- the coverage measurement against its own thresholds, when the unit gate ran;
- the Sonar scope that was measured, when Sonar was planned;
- every owner-approved debt that keeps a gate red;
- the verdict.

## Results

| Status | Exit code | Evidence | Classification |
| --- | --- | --- | --- |
| `pass` | Exactly `0` | Required | None |
| `fail` | Non-zero | Required | `in-boundary`, `boundary-drift`, or `flaky` |
| `external-blocker` | Any | Required | `external-blocker` |
| `skipped-not-requested` | None | None | None |

`skipped-not-requested` is available to the `e2e` gate alone, and it carries an `E2E_NOT_REQUESTED`
finding. Every other gate either ran or the invocation is blocked, because a gate that quietly did not
run reads exactly like a gate that passed.

A pass with no evidence reference is a narration. The evidence is what a later reader opens to
disagree with this receipt, so it is required for every executed gate including the green ones.

## Coverage

Coverage exists only when the unit gate ran, and it names its own evidence. Statements, lines,
functions, and branches are each compared against their own threshold; a branch threshold folded into
the statement figure is how an untested error path passes.

A metric below its threshold makes the unit-coverage result a failure. It is not a note beside a green
gate, and the receipt records `COVERAGE_BELOW_THRESHOLD`.

## Sonar

When Sonar was planned, the receipt states whether the scope was `new-code` or `overall`.

A passing `new-code` result requires a `SONAR_NEW_CODE_ONLY` finding. The pinned gate measures the
change, so a green result is a statement about the diff and the project underneath it may still be
red. Recording the scope is what stops a green gate from being read later as project health.

## Debt

A debt keeps one gate red on purpose. It names its identifier, its gate, the approval, the owner, and
the expiry, and it covers only an `in-boundary` failure: the kind the delivery owner can fix.

A debt against a gate that passed records nothing, and a debt against a `boundary-drift` failure owes
away something that belongs to the boundary owner. Both are rejected, which is what keeps declared
debt distinct from silent debt.

## Verdict

`pass` requires every required gate to have passed, or to have failed `in-boundary` under a declared
debt. Everything else is `fail`, including a required gate the environment blocked: an unmeasurable
gate is not a passed one.

## Blocked receipt

A blocked receipt has no verification. It contains one typed failure, the gates and references
involved, the owning domain, retryability, and, only when retryable, a single-use resume token with the
required material delta.

## Failure codes

| Code | Owning issue | Valid material delta |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | Corrected input. |
| `SOURCE_DRIFT` | The observed source no longer matches the frozen head. | Refreshed source binding. |
| `PREDECESSOR_MIXED` | Two predecessors describe different heads. | One coherent predecessor set. |
| `PREDECESSOR_STALE` | A predecessor fingerprint no longer matches the frozen source. | A refreshed upstream receipt. |
| `GATE_UNAVAILABLE` | A required gate cannot be executed here at all. | A working gate environment. |
| `DEBT_UNAPPROVED` | A debt has no live owner approval. | The owner approval, unexpired. |
| `NO_PROGRESS` | A resume adds no effective delta. | Materially new predecessor, gate, debt, or source. |

There is no repair code, because repair is not this operator's job. An `in-boundary` failure is
returned as a red verdict to the owner who can fix it, and the fixed delivery comes back as a new head
with a new predecessor fingerprint.

## Cross-field invariants

- `outcome="verified"` requires `receipt.status="verified"`, non-null `verification`, null `failure`,
  and null `resume`.
- `outcome="blocked"` requires `receipt.status="blocked"`, null `verification`, and non-null `failure`.
  A retryable failure requires a resume; a non-retryable failure forbids one.
- `plannedGates` has no duplicate, `results` covers exactly the planned gates once each, and
  `requiredGates` is a subset of `plannedGates`.
- Each result's exit code, evidence, and classification match its status.
- `skipped-not-requested` appears only on `e2e`, and only with an `E2E_NOT_REQUESTED` finding.
- `coverage` is non-null exactly when the unit-coverage gate was measured, and no metric sits below its
  threshold beside a passing unit-coverage result.
- `sonarScope` is non-null exactly when Sonar was planned, and a passing `new-code` result carries a
  `SONAR_NEW_CODE_ONLY` finding.
- Every debt names a planned gate whose result failed `in-boundary`, and debt identifiers are unique.
- `verdict="pass"` requires every required gate to pass or to be debt-covered.
- `artifactRefs` is exactly the set of evidence references the results name.
- `handoff` is always `null`.

## Practical outcomes

Verify a backend delivery: format, lint, typecheck, build, and unit-coverage all pass with evidence,
Sonar passes on a new-code scope and the receipt says so, e2e is recorded as skipped because nobody
asked for it, and the verdict is green with no debt.

Verify the same delivery after a coverage regression: branches land under their own threshold, the
unit-coverage gate fails `in-boundary`, the verdict is red, and the receipt is returned to the backend
owner without a single line of source being touched here.
