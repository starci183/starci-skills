# `fe/visual-fidelity` input

## Context

- `context.implementerExecutionRef` and `context.reviewerExecutionRef` identify different executions.
- `context.implementerPrincipalFingerprint` and `context.reviewerPrincipalFingerprint` identify
  different principals.
- `context.reviewerContextFingerprint` is the exact SHA-256 fingerprint of `input.blindReviewPacket`.
- `context.reviewerModel=gpt-5.6-sol`, `context.reviewerCount=1`,
  `context.contextIsolation=fresh`, and `context.forkTurns=none` are fixed.
- `context.debug=true` exposes the normalized reviewer call/return and per-raster records in the
  terminal.

## Input

- `input.auditTargetScore`: Optional noncanonical progress target from 1 through 9. It is parent-held
  context and is not reviewer-visible.
- `input.blindReviewPacket`: The only reviewer-visible payload. It binds the capture receipt,
  preflight, source freshness, matrix/partition/round identity, exact ordered content-addressed raster
  cells, exact ordered canonical probe cells, one `lastScreenshotRef`, opaque Grammar/icon/media
  manifest fingerprints, and product-family benchmark rasters.

The packet requires uncropped host context, focused surface views, wide/intermediate/compact coverage,
and lifecycle evidence. Its primary evidence must include a settled populated happy-case hero with
representative data, the core task, and every major region visible. Empty/loading/skeleton/error and
recovery evidence only supplement that hero. Source, DOM, tests, measurements, authority prose,
producer rationale, previous feedback, suspected defects, and intended answers are forbidden from
the blind reviewer context.

Stale source, reused reviewer identity, fingerprint mismatch, forged/extra/reordered raster evidence,
or invalid probe parity prevents a passing review. A packet that reaches the reviewer but lacks enough
visual evidence produces `insufficient-evidence`, not a guessed verdict.
