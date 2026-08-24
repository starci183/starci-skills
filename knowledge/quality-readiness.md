# Quality readiness and repair

| Field | Value |
| --- | --- |
| Knowledge ID | `quality.readiness-repair` |
| Operators | `workflow-diagnose, readiness-inventory, rule-binding-check, finding-repair, debt-repay` |
| Search tags | `diagnose, stale, readiness, repair, debt, rule binding, gate` |
| Dependencies | `workspace.routing, quality.source-gates` |

## Record

Diagnosis traces one pinned workflow invocation without mutation. It distinguishes an evidenced cause from an inconclusive trace or unavailable external dependency; absence of evidence is never a diagnosis. Inventory runs deterministic registry, route, ownership, hash, and gate-presence checks before retrieving this record. It returns green only when every declared gate has fresh proof, findings only for measured product-owned failures, and blocked when stale or unavailable authority prevents a verdict.

Rule-binding audit proves that each declared rule has exactly one accountable executable owner and that the rule, gate, and published-machine revisions agree. Missing, duplicate, orphaned, shadowed, and revision-mismatched bindings are findings; stale or unreadable registries are blockers, not failures.

Repair changes one approved finding boundary. Before mutation it revalidates finding identity, source baseline, owner, approval revision, and target hashes. A stale finding returns to inventory; boundary drift or unavailable dependencies stop without partial writes. After mutation it reruns the narrow proving gate and then inventories again. A repair is successful only when the original finding disappears without weakening, skipping, suppressing, or substituting a gate.

Debt repayment acts only on one owner-approved debt record with baseline, closure criterion, permitted writes, and expiry. Every iteration must produce a strictly better metric or a smaller declared remainder. A repeated fingerprint, unchanged metric, expired approval, scope drift, or exhausted iteration budget stops the loop. Debt closes only on fresh independent green evidence.

Inputs, loaded slices, command captures, worker observations, receipts, and repair plans remain task-session-only and are purged at every parent terminal. Only approved source mutations survive. Cache reuse requires an exact fingerprint over target revision, command and configuration revision, toolchain, environment, knowledge generation, and applicable evidence inputs. Cached failures and blockers never become green; a cache candidate is untrusted until its receipt and lineage validate.
