# `delivery/impact-classify` input

Classify whether one approved product mission changes only frontend source or also requires a backend contract. The input binds the approved mission artifact, fresh business head, routed role metadata and source-head hashes. Product source bodies are forbidden.

The classification is conservative: a new or changed persisted state, invariant, permission, API field, operation, event, migration or server-owned readiness rule requires the backend lane. A visual-only composition with unchanged transport and domain behavior is frontend-only.

## JSON architecture

- `provided` carries exact mission, approval, business-head and route receipt refs from the parent skill.
- `loads` resolves those bindings plus the declared decision knowledge at runtime; product-source bodies remain forbidden.
- `session` owns input/output/scratch refs until the parent skill terminates.
