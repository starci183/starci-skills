# `core/handoff-ack` output

- `output.outcome`: `accepted`, `rejected`, or `blocked`.
- `output.ackRef`: immutable acknowledgement reference, else null.
- `output.purgeRefs`: retained refs the runtime may purge after acceptance.
- `output.evidenceRefs`: exact comparison evidence.
- `output.reason`: rejection or blocker explanation, otherwise null.
