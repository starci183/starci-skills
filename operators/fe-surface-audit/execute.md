# Execute `fe.surface.audit`

## Single job

Observe one rendered surface and return findings. This is one linear operator invocation. It does not
call another operator, route a workflow, pause internally, or return control instructions. It repairs
nothing, restyles nothing, and writes no product source.

Readiness, capture, and judgement are one job here, not three. Splitting them produced a familiar
failure: a capture taken before the surface was ready, judged by a step that could no longer tell,
against evidence it had not itself collected. A single operator that waits, measures, and judges under
one receipt cannot lose that connection.

## Measurement beats claim, always

Each node carries the identifiers it claims to satisfy. The audit measures what the surface actually
renders and compares the measurement against the claim.

A claim is never evidence of passing. A node claiming `GAP-4` while the computed gap measures
`1.5rem` is a finding, and no amount of claiming changes the measurement. This is the whole mechanic:
the claim exists so it can be contradicted.

## Three finding classes

1. **The claim and the measurement disagree.** The node names a rule, the rendered value is not what
   that rule declares. The finding carries the `VALUE_DRIFT` cause tag and names the drifting rule,
   which must be a rule that node actually claimed. Drift from a rule nobody claimed is not drift.
2. **A node carries a presentation value and claims nothing.** Nobody owns the value, so nothing can
   be checked against it. The finding is `PROOF_MISSING`, usually with `WRONG_OWNER`. An unclaimed
   rendered value that produces no finding is the silent failure this operator exists to end.
3. **A claimed identifier is absent from the bound inventory.** The node names something the published
   knowledge does not contain. The finding is `PROOF_MISSING`, it names the unpublished identifier in
   its own field, and it cites no rule, because citing one would give the fabricated identifier the
   appearance of a home.

The third class is a finding about a claim the audit read, not a defect in the audit. `UNKNOWN_RULE`
is the separate failure for the audit itself reaching for an identifier outside the inventory, which
blocks the invocation instead of producing a finding.

## Verdict vocabulary

Findings use the canonical verdict model published in the UI knowledge index, and nothing else.

Base verdicts are exactly `PASS`, `COMMON_CAPABILITY_MISSING`, `COMMON_IMPLEMENTATION_GLITCH`,
`FAMILY_OVERRIDE_GLITCH`, `APP_REIMPLEMENTATION`, `APP_OVERRIDE`, `APP_WORKAROUND`, and
`PROOF_MISSING`.

Cause tags are exactly `VALUE_DRIFT`, `VENDOR_LEAK`, `WRONG_OWNER`, `OFF_SCALE_VALUE`, `DOUBLE_OWNER`,
`PHYSICAL_SIDE_DRIFT`, and `STATE_OR_VIEWPORT_DRIFT`.

Evaluate capability, isolated Common output, family delta, app delta, then owner and state evidence.
One finding carries one base verdict and zero or more cause tags. Several failed layers produce linked
findings; they are never collapsed into a composite verdict or suppressed by first-match logic. `PASS`
is valid only where no failure finding stands.

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input, prior receipt, frozen source binding, applied head | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind authority | knowledge index and every topic with its fingerprint and inventory, application receipt with its claims, routed source head, runtime endpoint | — | — |
| 3 | Confirm the surface | observed checkout at the routed route | — | — |
| 4 | Reach readiness | matrix entry, its viewport, color scheme, state, and declared readiness condition | — | `RUNTIME_UNAVAILABLE` |
| 5 | Capture | the ready surface for one matrix entry | `<matrixId>.capture.json` | `EVIDENCE_MISSING` |
| 6 | Measure | captures, nodes inside the observed owners, the identifiers each node claims | — | — |
| 7 | Compare and judge | measurements, claims, the bound rule inventory | — | `UNKNOWN_RULE` |
| 8 | Emit and stop | everything above | — | — |

Validation rejects a stale source binding, an applied head that differs from the observed head,
duplicate topics, a cross-filed identifier, two matrix ids for one condition, and unchanged progress.
The routed checkout is observed again before anything is captured, and a head that differs from the
applied head returns the same drift failure with nothing captured, because the surface would not be
the surface that was applied.

Every claimed identifier is resolved against the bound inventory and filed as known or unpublished; a
verdict is never recorded for a node that was not measured, and each finding comes from the canonical
vocabulary. Emission returns one output conforming to `output.schema.json`, registers every capture in
`artifactRefs`, and binds every fingerprint. It repairs nothing and never turns a proposed fix into a
verdict.

## The audit changes nothing

No finding is a repair, a workaround, or an instruction. A drift stays a drift in the receipt until a
resolution publishes a new value and the applier writes it, and the same surface is audited again.

This separation is why the receipt is worth anything: an operator that could fix what it found would
always be able to report a clean surface.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta. A resume that adds no knowledge, applied source, matrix, or runtime change returns
`NO_PROGRESS`. Republished knowledge must arrive as a new topic fingerprint; the same fingerprint
cannot yield a different verdict.

## Mandatory attacks

The operator cannot report an audit while any applicable item remains unresolved:

- a declared matrix entry produced no capture;
- a finding cites evidence that is not the capture of the entry it names;
- a verdict was recorded for a node and property that were never measured;
- a rendered value carries no claim and no finding says so;
- a claimed identifier resolves to nothing and no finding names it;
- a drift names a rule the node never claimed;
- a `PASS` stands on the same node and property as a failure finding;
- a claim was accepted as evidence that the node passes.
