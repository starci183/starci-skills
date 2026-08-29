# `platform/tunnel-apply` input

- `context.approvedPlan`: exact plan hash, resource identities, origin, protocol, and effect list.
- `context.approval`: authorization for precisely that plan and effect set.
- `context.credentialCapability`: opaque handle and minimum write capabilities; never credential values.
- `context.observedState`: exact pre-mutation resource fingerprint.
- `input.execution`: expected plan hash, bounded helper reference, and public HTTPS probe URL.

No discovery, workflow routing, orchestration, or session lifecycle belongs in this contract.
