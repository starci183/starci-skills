# Execute `quality.verify`

## Single job

Run the declared gates for one bounded delivery against one frozen head and return the exact measured
receipt. This is one linear operator invocation. It does not call another operator, route a workflow,
pause internally, or return free-form control instructions.

What was built, why it was built, and whether it was a good idea all arrive decided. This operator
answers one question per gate: what did the pinned command return, and what does that mean under the
declared classification policy.

## Verification only

Quality never repairs and never redesigns. The operator does not touch product source, does not adjust
a gate command or its configuration, and does not substitute an easier check for a hard one.

A failing gate is reported, not fixed. The receipt names the gate, the exit code, the evidence, and the
classification, and the owner who can fix it reads it. A red receipt is a complete, successful
invocation of this operator; only an inability to reach any verdict is a block.

Because nothing but gate evidence is written, `artifactRefs` is exactly the set of evidence references
the results name. A reference appearing there that no result names is a write this operator was not
allowed to make, and it is rejected as such.

## A gate result is measured, never narrated

Every executed gate carries its command reference, its exit code, and its evidence reference. A pass
means exit code zero with evidence beside it. A failure means a non-zero exit code with evidence and a
classification.

The classification is drawn from the structured diagnostics after the command ran, never chosen before
it:

- `in-boundary` when the delivery owner can fix it;
- `boundary-drift` when fixing it would change an approved boundary;
- `flaky` when identical source and environment produced contradictory outcomes under the declared
  bounded confirmation policy;
- `external-blocker` when the environment or a dependency prevented a verdict at all.

A rerun exists to distinguish those four. It never exists to convert an unexplained failure into a
pass, and a cached result never upgrades: a cached failure stays a failure, and a cache hit is trusted
only when the full fingerprint over head, command, configuration, toolchain, and environment matches.

## Two facts about this codebase

**Sonar measures new code only.** The pinned gate is scoped to the change, so a green Sonar result is a
statement about the diff and not about the project, and a project may sit red beneath it. When
`sonarScope` is `new-code`, a passing Sonar result must be accompanied by a `SONAR_NEW_CODE_ONLY`
finding. Without it, a later reader takes a green gate for project health, which is the exact
misreading this operator exists to prevent.

**End-to-end is never run unless explicitly requested.** The suite runs only when the caller asked for
it in this invocation. Otherwise the gate is recorded as `skipped-not-requested` with an
`E2E_NOT_REQUESTED` finding: no command, no exit code, no evidence, and no implication that behaviour
was proved.

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input, `@receipt/<receiptType>/<invocationId>`, `@fe` or `@be` (the frozen head of the verified boundary) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Consume the predecessors unchanged | `@receipt/<receiptType>/<invocationId>` (each upstream receipt by reference, type, fingerprint, and head) | — | `PREDECESSOR_MIXED`, `PREDECESSOR_STALE` |
| 3 | Verify the head | `@fe` or `@be` (the observed head of the verified boundary, against the frozen head) | — | — |
| 4 | Run the gates in declared order | `@gates/<project>/<role>` (the declared gate plan and repository entrypoints), `@fe` or `@be` (the subject each gate measures) | `@artifacts/gates/<gate>.json` | `GATE_UNAVAILABLE` |
| 5 | Apply the coverage policy | `@artifacts/gates/<gate>.json` (the unit gate's coverage output), `@gates/<project>/<role>` (the four thresholds) | `@artifacts/gates/unit-coverage.coverage.json` | — |
| 6 | Classify each failure | `@artifacts/gates/<gate>.json` (structured diagnostics from every red gate) | — | — |
| 7 | Apply approved debt | `@debts` (owner-approved debt records and their expiry) | — | `DEBT_UNAPPROVED` |
| 8 | Emit and stop | everything above | `@artifacts/quality-receipt.json` | — |

Validation rejects predecessor heads that disagree, a stale source binding, an unrequested e2e plan, a
Sonar plan that contradicts its scope, a debt whose approval has expired, a frontend delivery carrying
debt, and an unchanged resume. Predecessors are bound and recorded as `PREDECESSOR_CONSUMED`: nothing
they decided is re-derived, re-planned, or second-guessed. The observed head is verified again before
the first gate runs, and a difference returns the same drift failure, because a gate measuring a
different head measures a different delivery.

The gates run as format check-only, lint at zero errors and zero warnings, typecheck and build through
repository entrypoints, unit as the sole coverage producer, integration for the declared connected
boundaries, e2e only when requested, and Sonar last and inheriting nothing; each run writes its own
evidence under the artifact root. Statements, lines, functions, and branches are compared against
their own thresholds, and branches carry an independent threshold because folding it into the
statement figure is how an untested error path passes; a metric under its threshold makes the unit
gate a failure and records `COVERAGE_BELOW_THRESHOLD` rather than a note beside a green result.

Each failure is read from the structured diagnostics and assigned one classification. No gate is ever
skipped, suppressed, substituted, or moved with `passWithNoTests`, and a zero-test run is not a pass.
A gate may stay red only under an owner-approved, unexpired debt covering an `in-boundary` failure,
recorded as `DEBT_DECLARED`; a debt on a passing gate or on a `boundary-drift` failure is refused.
Emission computes the verdict, writes the receipt under `input.project.artifactRootRef`, registers
every evidence reference in `artifactRefs`, returns one output conforming to `output.schema.json`, and
binds every fingerprint.

## The verdict

`verdict: "pass"` requires every required gate to have passed, or to have failed `in-boundary` under a
declared debt. Any other shape is `verdict: "fail"`, including a required gate blocked by the
environment: an unmeasurable gate is not a passed one.

A non-required gate that fails is recorded and does not by itself turn the verdict red. That is the
whole reason `required` exists, and it is the caller's declaration, never this operator's judgement.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta. A resume that adds no predecessor, gate, debt, or source change returns `NO_PROGRESS`.
A repaired delivery arrives as a new head and a new predecessor fingerprint; the same fingerprint
cannot yield a different answer.

## Mandatory attacks

The operator cannot report a verification while any applicable item remains unresolved:

- a planned gate has no result, or a result names a gate nobody planned;
- a pass carries a non-zero exit code, or no evidence to open;
- a failure carries no classification, or a classification chosen before the command ran;
- the e2e gate ran without an explicit request;
- a green Sonar result on a new-code scope is recorded without saying so;
- a coverage metric sits below its threshold beside a passing unit gate;
- a debt covers a gate that passed, a boundary-drift failure, or has no live approval;
- an artifact reference appears that no gate result produced.
