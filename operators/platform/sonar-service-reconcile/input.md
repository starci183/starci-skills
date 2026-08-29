# `platform/sonar-service-reconcile` input

- `context.authority`: exact plan approval and allowed Sonar effect classes.
- `context.credentialCapability`: opaque `sonar:project-admin` handle and custody evidence.
- `context.observedState`: current service availability, provider fingerprint, and only the declared projects.
- `input.desiredState`: exact project keys, source revisions, profiles, gates, enforcement, and effects.

Raw credentials, broad provider discovery, workflow routing, orchestration, and session cleanup are excluded.
