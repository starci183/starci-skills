# `test/uat-result-publish` input

## Context

- `context.snapshotRef`: Frozen canonical snapshot.
- `context.sourceFingerprint`: Exact source frozen by that snapshot.
- `context.priorVisualPassRef`: Exact final blind visual PASS preceding UAT.
- `context.priorVisualPassedAt`: Timestamp of that PASS, used to reject stale findings.
- `context.snapshotReturnReceiptRef`: Exact validated snapshot-freeze RETURN.
- `context.caseFreezeReturnReceiptRef`: Exact validated case-freeze RETURN.
- `context.behaviorProofReturnReceiptRef`: Exact validated behavior-proof RETURN.
- `context.uxProofReturnReceiptRef`: Exact validated UX-proof RETURN.
- `context.uiProofReturnReceiptRef`: Exact validated UI-proof RETURN.

## Input

- `input.evidenceRefs`: Exact browser, account, behavior, UX, or UI evidence.
- `input.browserSessionRef`: Exact visible-browser session.
- `input.accountRef`: Fresh isolated account or explicit anonymous identity.
