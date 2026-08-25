# `delivery/impact-classify` output

Return exactly one decision: `backend-required`, `frontend-only`, or `blocked`. A ready result contains one session-only impact receipt and the exact role set. It never contains business or source bodies.

## JSON architecture

`state` declares the deterministic decision and emitted contract. `produced` carries the impact receipt and affected roles; `context` lists exact bindings used. `cleanup` retains scratch refs only until `skill-terminal`, where they are purged.
