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

## Execution sequence

1. **Validate input and resume.** Apply `input.schema.json` and semantic validation. Reject predecessor
   heads that disagree, a stale source binding, an unrequested e2e plan, a Sonar plan that contradicts
   its scope, a debt whose approval has expired, a frontend delivery carrying debt, and an unchanged
   resume.
2. **Consume the predecessors unchanged.** Bind each upstream receipt by reference, type, fingerprint,
   and head. Do not re-derive, re-plan, or second-guess what they decided. Record
   `PREDECESSOR_CONSUMED`.
3. **Verify the head.** Reverify the observed source head against the frozen one before the first gate
   runs. A difference is `SOURCE_DRIFT`, because a gate measuring a different head measures a
   different delivery.
4. **Run the gates in declared order.** Format check-only, lint at zero errors and zero warnings,
   typecheck and build through repository entrypoints, unit as the sole coverage producer, integration
   for the declared connected boundaries, e2e only when requested, Sonar last and inheriting nothing.
   Each run writes its evidence under the artifact root.
5. **Apply the coverage policy.** Statements, lines, functions, and branches are compared against their
   own thresholds. Branches carry an independent threshold, because folding it into the statement
   figure is how an untested error path passes. A metric under its threshold makes the unit gate a
   failure and records `COVERAGE_BELOW_THRESHOLD`; it never becomes a note beside a green result.
6. **Classify each failure.** Read the structured diagnostics and assign one classification. Never skip,
   suppress, substitute, or `passWithNoTests` a gate to move it. A zero-test run is not a pass.
7. **Apply approved debt.** A gate may stay red only under an owner-approved, unexpired debt covering
   an `in-boundary` failure, recorded as `DEBT_DECLARED`. A debt on a passing gate or on a
   `boundary-drift` failure is refused.
8. **Emit and stop.** Compute the verdict, write the receipt under `input.project.artifactRootRef`,
   register every evidence reference in `artifactRefs`, emit one output conforming to
   `output.schema.json`, and bind every fingerprint.

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
