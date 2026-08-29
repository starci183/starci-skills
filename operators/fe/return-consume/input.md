# `fe/return-consume` input

## Context

- `context.expectedMissionId`: Expected mission.
- `context.expectedChildId`: Expected child call.
- `context.expectedResumeState`: Exact FE state to resume.
- `context.expectedReceiptType`: Exact runtime receipt type expected for this continuation.

## Input

- `input.receipt`: Typed runtime RETURN receipt to correlate and consume.
- `input.requiredAuthorityRefs`: Required returned authority.
- `input.requiredSourceHeads`: Required returned source heads.
