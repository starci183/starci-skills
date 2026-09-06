# Replan segment validation

Two independent occurrences exposed the same enforcement gap.

1. A migrated active session retained accepted attempts from its earlier scope, then added reviewed
   delivery discovery and replanned. The chain validator applied the new handoff ordering to the
   preserved historical segment and rejected an architecture attempt that had lawfully preceded the
   new business decision.
2. The same session routed from a terminal attempt into a fresh preflight. The chain validator still
   required the preceding historical operator's `Next` table to name that preflight, even though the
   recorded `replanned` transition was the authority for the new segment.
3. After that repair, a later user-confirmed restatement created another replan boundary. The gate
   skipped the edge entering the new segment but still rechecked an older historical `Next` mismatch
   before the boundary, proving that the reachability loop itself had not been segmented completely.

The repair keeps all historical requests and receipts immutable. `validate-session` derives the
latest replan boundary for the current goal version, and `validate-chain` applies current delivery
ordering and `Next` reachability only from that boundary. Historical steps still accumulate their
accepted inputs and role bindings; shape, leases, goals, evidence manifests, and every adjacency in
the active segment remain gated normally.
