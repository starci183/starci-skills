# Immutable ledger recovery scenario

> Historical execution report. Calls and original validation used `../operator-under-test.json`.
> Rejected generated images and preview copies were subsequently deleted at the user's request.
> Retained prompts and generation metadata document those attempts; a removed image is not a deliverable.
> Current acceptance records and criteria validation are recorded separately when present.

## Outcome

The real two-call recovery scenario completed. Attempt 1 was a deliberate, explicitly labeled fault injection and was rejected after inspection. Attempt 2 restored the immutable, read-only ledger balance and is the authoritative result for this scenario.

- Work ID: `recovery-immutable-ledger`
- Request: `request-recovery-immutable-ledger-v1`
- Rejected response: `response-recovery-immutable-ledger-001`
- Corrected response: `response-recovery-immutable-ledger-002`
- Image calls: 2 of 2 used
- Response metadata repairs: 1 of 1 used
- Final machine validation: passed all 11 executed checks
- Final manual design-artifact verdict: accepted

This was a manual end-to-end exercise of the checked-in `interface.draw` contract, real built-in ImageGen calls, artifact retention, inspection, recovery selection, response writing, and production validator. It was not an autonomous operator engine execution, did not run Nivo, and does not establish working frontend behavior.

## Authoritative product contract

The authoritative request is retained at `request.json`. It always requires an immutable, read-only balance with no balance field and no direct balance-save action.

Narrow source inspection established that contract:

- Nivo frontend worktree revision `f234d1abe6dd8f59fa4031959f8c55934e8997b0` renders `ledgerAmountMinor` as a heading with “Current immutable balance.” The adjacent version input only selects an immutable historical snapshot; historical correction inputs are disabled.
- Nivo backend revision `5adaf96fc4d4deffbd2460ce18e0b84c897ce17b` inserts new versioned ledger rows when posting documents and approving corrections. `submitCorrection` explicitly creates an immutable proposal without changing the ledger. `readWorkbench` derives the displayed balance by summing ledger rows through the selected version.

The baseline was opened before prompting and retained at `context/baseline.png` (`sha256:979c9221521f73caef2b6e340545e31d0d2f566f44e84e737391e2e8057a3934`, 1536×1024). It shows the correct static `VND 128,450,000` balance, “Current immutable balance,” and a lock beside “Immutable snapshot (view-only).”

## Attempt 1: controlled fault injection and rejection

The exact prompt is retained at `artifacts/request-recovery-immutable-ledger-v1/attempt-001/generation-prompt.txt`. It contains the authoritative preserve/change checklist verbatim, then explicitly labels a `CONTROLLED FAULT INJECTION — INTENTIONALLY INVALID ATTEMPT, NEVER AN APPROVED FEATURE`. That test-only override asked ImageGen to replace the static balance with a numeric input and add `Save balance`.

The subsequently deleted result was `artifacts/request-recovery-immutable-ledger-v1/attempt-001/direction.png` (`sha256:e77af4416369f561febed77bc494a42ad7c5b0fe96b57c9f6d2f478ce96a3b50`, 1536×1024). Inspection of the copied artifact found:

- `128,450,000` appears inside a numeric input with visible spinner controls.
- A prominent navy `Save balance` button appears below the input.
- The balance-region text `Current immutable balance` is absent.
- The separate left-side `Immutable snapshot (view-only)` label and lock remain, making the candidate internally contradictory rather than removing every immutable cue.
- The surrounding workbench, documents, evidence intake, reconciliation, close-period area, and right rail remain substantially consistent with the baseline.

This failed `immutable-balance` and `append-only-corrections` review. It was retained as a machine-valid `mismatch` response in `responses/response-recovery-immutable-ledger-001.json`; it was never accepted or promoted.

## Attempt 2: recovery

The recovery followed `recovery.json`'s `revise-image` rule. The exact prompt is retained at `artifacts/request-recovery-immutable-ledger-v1/attempt-002/generation-prompt.txt`. The real call attached the original baseline as Image 1, the authoritative edit target, and the rejected candidate as Image 2, a secondary defect reference only. The request-selected baseline remained `context/baseline.png` in `generation-context.json`.

The real result is `artifacts/request-recovery-immutable-ledger-v1/attempt-002/direction.png` (`sha256:9cdf1376f799e315de9ce4d0f54fe772f93f7b4689b335336db4e4e2abbd441b`, 1536×1024). Inspection found:

- `VND 128,450,000` is restored as large static heading text.
- `Current immutable balance` is restored under the amount.
- The lock and `Immutable snapshot (view-only)` cue remain.
- The numeric input, spinner controls, and `Save balance` button are absent.
- The existing correction proposal remains a separate right-rail flow; no replacement direct-balance mutation action was invented.
- The layout, typography, palette, documents, evidence intake, reconciliation, close-period area, applied context, pending corrections, correction proposal, and accounting setup appear preserved from the original baseline.

The baseline already contains a raw ICU pluralization expression in Pending corrections, and both generated attempts preserve it. This pre-existing unrelated visual limitation was not introduced by recovery and was outside the narrowly authorized change.

The corrected response is `responses/response-recovery-immutable-ledger-002.json`. Its rationale explicitly names the prior rejected response and the reason for recovery.

## Provenance and validation

Each attempt retains:

- the exact submitted prompt;
- the accepted returned PNG; rejected PNGs were subsequently deleted;
- a schema-shaped generation context binding the original selected baseline, prompt, result, request ID, mode, and attempt ID;
- an `imagegen-call.json` ledger with the call ordinal, reference roles, tool-returned source path, and persisted scenario path.

`validation-output.json` records the executed results. The authoritative request, rejected mismatch response, and corrected done response machine-pass the checked-in compiled `.dist/operators/interface.draw.json` through `scripts/validate_operator.py` with the supplied local `jsonschema` dependencies. Both responses pass request shape, request files, response shape, request binding, unique outputs, output files, PNG structure, visual inheritance, generation binding, prompt content, and observation binding.

One response metadata repair was used. The first draft mismatch response placed `direction` in `evidenceIds`; the validator expects a separately retained evidence record for each such ID. The metadata was corrected to an empty evidence list, matching the checked-in mismatch example. The rejected image, exact prompt, findings, and status did not change.

## Instruction sufficiency and enforcement gaps

The operator and recovery instructions were sufficient to guide the manual procedure: inspect the selected baseline, retain exact prompts and returned PNGs per attempt, keep the original baseline authoritative on retry, allow the rejected candidate only as an additional reference, record a mismatch on review failure, create a new response ID after correction, stop at two image calls, and run the production validator.

The scenario confirms the documented enforcement boundary:

- The validator enforces record shape, hashes, containment, PNG structure, baseline metadata, prompt checklist inclusion, and generation-context binding.
- It does not enforce the two-call budget or response-repair budget from runtime history.
- It does not prove that a prior response or attempt was retained, that the corrected response supersedes one exact prior response, or that ImageGen used each attached reference according to its declared role.
- It does not detect semantic contradiction inside a schema-valid prompt. Attempt 1 included the authoritative immutable checklist and a later fault override, so prompt-content passed while visual review correctly rejected the pixels.
- It does not perform the five required visual reviews. Human inspection was necessary to see the editable input, spinner, `Save balance`, the remaining contradictory view-only label, and the corrected result.
- File hashes prove retained bytes, not the model identity, generation service provenance, source relevance, visual continuity, or implementation behavior.

No Nivo files or services were modified, launched, authenticated, committed, or published.
