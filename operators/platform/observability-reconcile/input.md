# `platform/observability-reconcile` input

- `context.authority`: exact plan approval, writable resource set, and effect classes.
- `context.credentialCapability`: opaque capability for one remote-write destination.
- `context.observedState`: current configuration fingerprint and only declared resources.
- `input.desiredState`: exact services, scrape targets, dashboards, destination, filtering policy, and effects.

Raw credentials, broad service discovery, product diagnosis, workflow routing, orchestration, and session cleanup are outside this contract.
