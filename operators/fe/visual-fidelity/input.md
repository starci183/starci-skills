# `fe/visual-fidelity` input

## Context

- `implementerExecutionRef` and `reviewerExecutionRef` must differ.
- `reviewerModel=gpt-5.6-sol`, `reviewerCount=1`, `contextIsolation=fresh`, and `forkTurns=none` are fixed by `config.yaml`.
- `debug=true` requires terminal emission of the normalized AI contract and every per-raster inspection record.

## Input

- `blindReviewPacket` is the only reviewer-visible payload.
- It contains the validated capture `captureReceiptId`, opaque raster cells, exact probe phases, latest-mutation/capture fingerprints, timestamps, and exactly one `lastScreenshotRef`.
- It includes an uncropped host-context raster and focused surface raster so a distant whole-screen image cannot hide local defects.
- It excludes source, DOM, tests, measurements, authority prose, producer rationale, previous feedback, suspected defects, prior verdicts, and intended answers.

The manifest must be byte-for-byte equivalent to the packet frozen by that capture receipt. Any stale fingerprint, pre-mutation capture, forged/extra/reordered raster, reused execution identity, missing raster, missing inspection record, or extra reviewer-visible context blocks the invocation.

## Contract fields

- `context.implementerExecutionRef`: Typed field bound to this single operator job.
- `context.reviewerExecutionRef`: Typed field bound to this single operator job.
- `context.reviewerModel`: Typed field bound to this single operator job.
- `context.reviewerCount`: Typed field bound to this single operator job.
- `context.contextIsolation`: Typed field bound to this single operator job.
- `context.forkTurns`: Typed field bound to this single operator job.
- `context.debug`: Typed field bound to this single operator job.
- `input.blindReviewPacket`: Raster-only packet. Cell labels are opaque execution labels, never producer intent or a suspected answer.

## Contract fields

- `context.implementerPrincipalFingerprint`: Runtime-attested principal fingerprint for the implementer.
- `context.reviewerPrincipalFingerprint`: Runtime-attested principal fingerprint for the blind reviewer; it must differ from the implementer principal.
- `context.reviewerContextFingerprint`: Fingerprint of the fresh raster-only context delivered to the reviewer.
