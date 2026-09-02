# Output of `content.generate`

The operator returns one closed envelope with `outcome` equal to `generated` or `blocked`. It never
emits a handoff or free-form routing instruction.

## Generated receipt

A generated receipt contains:

- exact project, source, unit, language, stage-mode, score-floor, curriculum, brief, input, and
  progress bindings;
- the frozen teacher brief with its outcomes, claims, examples, and dispositions;
- one written edition per declared natural language, each naming the outcomes it covers;
- the image with its prompt, the claims it encodes, and its inspection;
- one implementation track per declared language with its build command and exit code;
- the executable check with its contract fingerprint before and after, its iteration count, and one
  run per track;
- the independent critique with its execution, scores, findings, and verdict;
- the artifacts the critique approved.

The receipt proves this unit was built against a frozen brief and survived an independent reading. It
does not prove the unit was published, and it carries no claim about learner results in production.

## The brief is the measure

Every article edition names the outcomes it covers, and those may only be outcomes the brief
published. On a generated receipt every edition covers the whole published set. An edition that covers
part of the brief is a partial lesson in one language and a complete one in another, which is exactly
the silent defect this check exists to catch.

## Evidence, not prose

A track carries its build command and its exit code. A run carries its command, its exit code, and its
assertions. Neither carries a sentence claiming success. The contract fingerprint is recorded twice,
before and after the repair loop, and the two must be equal.

## The critique

The critique is the last step and the only one that judges. It runs fresh, inherits no turns, is never
the execution that wrote the brief or an edition, and records `producerRationaleReceived` as false.
`receivedArtifactRefs` lists what it was given, and every produced artifact must appear there.

Approval requires every applicable score at or above the bound `minimumScore` of `85` and no open
error finding. A revision verdict must name at least one error finding, assigned to exactly one owning
stage, and that stage must be one that actually ran.

## Blocked receipt

A blocked receipt has no unit. It contains one typed failure naming the owning stage, the exact
references involved, the owning domain, retryability, and, only when retryable, a single-use resume
token with the required material delta.

## Failure codes

| Code | Owning issue | Valid material delta |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | Corrected input. |
| `SOURCE_DRIFT` | The observed source no longer matches the frozen head. | Refreshed source binding. |
| `BRIEF_UNBOUND` | The brief cannot be frozen from the bound curriculum and source. | The missing curriculum or source evidence. |
| `OUTCOME_UNCOVERED` | An edition leaves a published outcome uncovered. | A rewritten edition, or a narrowed brief. |
| `CODE_BUILD_FAILED` | A declared track does not build. | A repaired track. |
| `E2E_FAILED` | A declared executable check fails within the iteration bound. | A repaired implementation, then a rerun. |
| `CONTRACT_WEAKENED` | The executable contract moved during the repair loop. | The restored contract, and a rerun that does not touch it. |
| `IMAGE_UNAVAILABLE` | A required image cannot be generated to the brief's claims. | A working generator, or a disabled image stage. |
| `REVIEW_REVISION_REQUIRED` | The independent critique returned a revision. | The repairs the findings name, by owning stage. |
| `REVIEW_ROUNDS_EXHAUSTED` | The approved review rounds are spent. | More approved rounds, or a narrower unit. |
| `NO_PROGRESS` | A resume adds no effective delta. | Materially new curriculum, source, findings, or scope. |

`REVIEW_REVISION_REQUIRED` is the expected outcome of a real review, not a defect. The findings name
their owning stage so the next invocation repairs the right thing rather than rewriting everything.

## Cross-field invariants

- `outcome="generated"` requires `receipt.status="generated"`, non-null `unit`, null `failure`, and
  null `resume`.
- `outcome="blocked"` requires `receipt.status="blocked"`, null `unit`, and non-null `failure`. A
  retryable failure requires a resume; a non-retryable failure forbids one.
- Every disabled stage is recorded as a `STAGE_DISABLED` finding.
- Article editions cover exactly the declared natural languages, once each.
- Every covered outcome was published by the brief, and on a generated receipt every edition covers
  every published outcome.
- A change or remove disposition names what it acts on.
- A disabled image stage produces no image, a required one produces one, and every encoded claim was
  published by the brief. A generated receipt requires a passing claim-fidelity inspection.
- Implementation tracks cover exactly the declared implementation languages, once each, and a
  generated receipt requires every build to exit zero.
- The executable check exercises every declared track, exits zero on a generated receipt, and its
  contract fingerprint is unchanged before and after the repair loop.
- The critique runs fresh with no inherited turns, is not a producing execution, receives every
  produced artifact, and receives no producer rationale.
- An approved verdict requires every applicable score at or above `minimumScore` and no open error
  finding; a revision verdict requires at least one; a finding never names a disabled stage.
- A generated receipt requires an approved verdict and at least one approved artifact, and every
  approved artifact was produced by this unit.
- `artifactRefs` registers the brief, the critique, and every approved artifact.
- `handoff` is always `null`.

## Practical outcomes

Generate a lesson on idempotent writes: the brief publishes two outcomes and two claims, both the
Vietnamese and English editions cover both outcomes, the diagram encodes one claim, the TypeScript and
Go tracks build and pass the same executable contract, and a fresh reviewer approves with the lowest
score at 86.

Generate the same lesson when the Go track still double-applies a retry: no unit ships, the receipt
returns `E2E_FAILED` naming the track and the missing passing run, and the resume waits for the repair.
