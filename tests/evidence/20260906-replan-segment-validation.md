# Replan segment validation

Two independent occurrences exposed the same enforcement gap.

1. A migrated active session retained accepted attempts from its earlier scope, then added reviewed
   delivery discovery and replanned. The chain validator applied the new handoff ordering to the
   preserved historical segment and rejected an architecture attempt that had lawfully preceded the
   new business decision.
2. The same session routed from a terminal attempt into a fresh preflight. The chain validator still
   required the preceding historical operator's `Next` table to name that preflight, even though the
   recorded `replanned` transition was the authority for the new segment.

The repair keeps all historical requests and receipts immutable. `validate-session` derives the
latest replan boundary for the current goal version, and `validate-chain` applies current delivery
ordering and the first-step reachability reset from that boundary. Shape, inputs, roles, leases,
goals, evidence manifests, and every later adjacency remain gated normally.
