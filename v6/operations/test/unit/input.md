# Unit Test input

Validate with `validate-input.mjs` before reading source or running a command.

Input stage is `test.unit / ready` with `seed-evidence`. It binds the verified workspace route, one source role, the matching immutable StarCi reference, target manifests, the implementation change-set hash, exact unit targets, and a durable evidence root.

`sourceReferenceRef` must resolve through `../../../knowledge/references/catalog.json` to the same role as `sourceRole`. A reference supplies test-shape precedent only; current manifests and source own the command and behavior.
