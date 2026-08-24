# Backend plan challenge

| Field | Value |
| --- | --- |
| Knowledge ID | `be.plan-challenge` |
| Operators | `challenge` |
| Search tags | `backend, challenge, discrepancy, approval revision, source recheck` |
| Dependencies | `be.plan-compilation` |

## Record

Challenge the proposed revision independently against current authority. Re-query source discovery where necessary, reopen the cited schema and sibling files, and verify every behavior-to-path, pattern-to-path, exception, dependency, branch, test, exclusion, and write root.

## Outcomes

Return `clean` only when the exact revision remains valid. Return `revise` with typed discrepancies when the plan can be corrected inside the accepted demand. Return `blocked` when business authority, source truth, pattern accountability, or repository routing must change first.

Challenge performs no product write and cannot approve its own revision. Approval belongs to the skill state machine wait state and is valid only for the displayed plan hash and exact boundary.
