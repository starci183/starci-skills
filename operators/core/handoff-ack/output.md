# `core/handoff-ack` output

## JSON architecture

`state` routes the protocol decision. `produced` returns ackRef, purgeRefs. Ordinary scratch is purged at skill-terminal; handoff artifacts use exact consumer acknowledgement before their declared purge point.
