# `platform/tunnel-plan` output

- `output.outcome`: `ready` or `blocked`.
- `output.planRef` and `output.planSha256`: exact ephemeral plan identity only when ready.
- `output.effects`: minimal declared effect classes; never executable commands or credentials.
- `output.conflicts`: value-safe blockers; empty when ready.
- `output.evidenceRefs`: exact authority and resource evidence.

The Skill machine owns the next state; this operator performs no mutation.
