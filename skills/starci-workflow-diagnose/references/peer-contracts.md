# Canonical peer receipts

Use `runtime/receipt.schema.json` without a parallel envelope. A domain handoff emits `CALL`; its peer emits `RETURN`; the runtime emits `RESUME` addressed to this skill. Parent IDs form CALL→RETURN→RESUME, child identity is stable, and `trace.payloadRef` plus `trace.sourceHeads` remain equal. The runtime derives progress fingerprints; three identical trailing fingerprints are no-progress and block re-entry.

