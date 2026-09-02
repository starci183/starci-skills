# Execute `content.generate`

## Single job

Build one educational content unit and let an independent critique judge it. This is one linear
operator invocation. It does not call another operator, route a workflow, pause internally, or emit
free-form control instructions.

The v7 shape split this work across `brainstorm`, `write`, `code`, `image`, `e2e`, and `review`.
Those are now steps inside one execute sequence, run once in order. There is no DAG and no
sub-operator: the ordering that mattered is preserved as a sequence, and the boundaries that mattered
are preserved as contract invariants.

## The brief comes first and constrains what follows

The teacher brief is written before anything else, from curriculum and source evidence, in one fresh
execution that inherits no turns. It publishes the learner inputs, the observable outcomes, the claims
a visual may encode, the examples, and the explicit add, change, and remove dispositions.

Everything after it is measured against it. An edition may only claim coverage of an outcome the
brief published, an image may only encode a claim the brief published, and every declared edition must
cover the whole published outcome set before the unit can ship. This is what "the brief constrains the
writing" means in an enforced contract rather than in an instruction.

## Generated code must actually run

Every implementation track is built with the exact command, and the exit code is read and recorded. A
non-zero exit code cannot ship: the lesson would tell a learner that code works on nobody's evidence.

The executable check runs the declared command per track inside a bounded run-read-repair loop. The
loop may repair the implementation. It may never move the contract it is measured by, so the contract
fingerprint is taken before the first run and compared after the last one. A test deleted, skipped,
loosened, or special-cased to make the run green is the failure this comparison exists to catch.

## The image is made to a stated intent

The visual is derived from the brief's claims, the prompt that states that intent is persisted, and
the result is inspected for legibility, hierarchy, and claim fidelity. A claim the brief never
published cannot appear, and a visual that fails its own claim-fidelity inspection cannot ship. An
image is not decoration added at the end; it is one of the claims, drawn.

## The critique is independent

The final critique is a fresh execution on this operator's own profile with no inherited turns, and
it is never the execution that produced the brief or any edition. It is given the produced artifacts
and the claims those artifacts make, and none of the producer's rationale: the artifact has to stand
up on its own reading.

It scores correctness, pedagogy, interview value, language, and, where those stages ran, visual
fidelity, code quality, and executable proof. Approval requires every applicable score at or above
`85` and no open error finding. Each finding names exactly one owning stage, and a finding cannot be
assigned to a stage that was disabled.

A unit that passes its own author's review has not been reviewed. The contract enforces that as three
separate refusals: shared executions, inherited turns, and producer rationale.

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input, `@dynamic/content-generation-receipt.json`, `@remote/minio/<contentId>/<locale>` (the frozen unit binding) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind authority | `@remote/minio/<contentId>/<locale>` (curriculum and style references as served), `@worktrees/sessions/central-runtime` (AI runtime configuration) | — | — |
| 3 | Write and freeze the brief | `@remote/minio/<contentId>/<locale>` (curriculum and source evidence) | `@dynamic/<briefTargetRef>` | `BRIEF_UNBOUND` |
| 4 | Write every declared edition | `@dynamic/<briefTargetRef>` (the frozen brief), input (the per-language destination) | `@dynamic/<language>.articleRef` | `OUTCOME_UNCOVERED` |
| 5 | Generate the image to its claims | `@dynamic/<briefTargetRef>` (the brief's claims and the stated image intent) | `@dynamic/<imageTargetRef>` | `IMAGE_UNAVAILABLE` |
| 6 | Implement every declared track | `@dynamic/<briefTargetRef>`, input (each track's exact build command) | `@dynamic/<track>.sourceRef` | `CODE_BUILD_FAILED` |
| 7 | Run the executable check | `@dynamic/<track>.sourceRef` (the executable contract), `@worktrees/sessions/central-runtime` (where each declared command runs) | — | `E2E_FAILED`, `CONTRACT_WEAKENED` |
| 8 | Take the independent critique | `@dynamic/<briefTargetRef>`, `@dynamic/<language>.articleRef`, `@dynamic/<track>.sourceRef`, `@dynamic/<imageTargetRef>` (every produced artifact and the claims it makes) | `@dynamic/<reviewTargetRef>` | `REVIEW_REVISION_REQUIRED`, `REVIEW_ROUNDS_EXHAUSTED` |
| 9 | Emit and stop | everything above | `@dynamic/content-generation-receipt.json` | — |

Validation rejects a stale source binding, a language without a destination, an executable check with
no code behind it, an image without its prompt, a refactor with no unit, a shared brief and critique
target, and unchanged progress.

The brief is one fresh execution with no inherited turns: it publishes outcomes, claims, examples, and
dispositions, and is then fingerprinted so nothing downstream may extend it. Each edition covers the
whole published outcome set and records its own execution. The image step persists the prompt that
states its intent alongside the result, copies the result to its target, and inspects it; a disabled
stage produces nothing and is recorded as disabled. Each track builds one shared behaviour, idiomatic
per language, with the exit code read rather than assumed.

The executable check fingerprints the contract before the first run and again after the last one, and
inside the bounded run-read-repair loop it may repair only the implementation or the harness. The
critique is a fresh execution on this operator's own profile with no inherited turns, given every
produced artifact and the claims those artifacts make, never the producer's rationale; it returns
scores, findings assigned to owning stages, and one verdict. Emission writes the receipt under
`input.project.artifactRootRef`, returns one output conforming to `output.schema.json`, binds every
fingerprint, and claims no publication, no learner outcomes in production, and no acceptance beyond
the checks actually run.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta. A resume that adds no curriculum, source, finding, or scope change returns
`NO_PROGRESS`. A revised brief must arrive as a new fingerprint; the same fingerprint cannot yield a
different answer.

## Mandatory attacks

The unit cannot be reported as generated while any applicable item remains unresolved:

- an edition claims an outcome the brief never published;
- a declared edition leaves a published outcome uncovered;
- an image encodes a claim the brief never published, or fails its own inspection;
- a track was never built, or its build exits non-zero;
- a declared track is never exercised by the executable check, or a check exits non-zero;
- the executable contract fingerprint moved during the repair loop;
- the critique received the author's rationale or inherited turns;
- an artifact was shipped that the critique never received;
- a score sits below `85`, or an error finding is still open, while the verdict says approved.
