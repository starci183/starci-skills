# `fe/return-consume` input

## Context

- `context.expectedMissionId`: Expected mission.
- `context.expectedParentId`: Exact parent call identity expected on the returned receipt.
- `context.expectedResumeState`: Exact FE state to resume.
- `context.expectedReceiptType`: Exact runtime receipt type expected for this continuation.

## Input

- `input.receipt`: Typed runtime RETURN receipt whose mission, parent identity, resume state, authority,
  and source heads must all correlate.
- `input.requiredAuthorityRefs`: Required returned authority.
- `input.requiredSourceHeads`: Required returned source heads.
