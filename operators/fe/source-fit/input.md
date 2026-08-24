# Source fit input

Source fit compares the approved block/layout intent and Grammar convergence result with the frontend source-contract export.

Provide one JSON value that validates against `input.schema.json`.

For every source candidate, include a resolved effective contract, not a local delta for the model to merge. The effective contract records:

- exact `baseRef` and `baseHash`;
- slots, state inputs, variable axes, extension policy and closed invariants inherited from the base;
- the source-owned delta with provenance;
- exact `effectiveRef` and `effectiveHash` computed by the source-context script.

Also provide the Grammar selections and gaps, the desired block tier, the exact source boundary and any already declared local extensions. Missing base or effective provenance makes the candidate unusable for `reuse` or `extend`.
