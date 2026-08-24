# E2E Test input

Validate with `validate-input.mjs` before starting services or creating test data.

Input stage is `test.e2e / ready` with `unit-pass`, `unit-evidence`, and `seed-evidence`. It binds verified FE and BE workspace routes, both immutable StarCi source references, current manifests, selected flow and seed hashes, exact journey scenarios, an isolated environment, and an evidence root.

Credentials are passed only by opaque provider reference. Raw secrets are forbidden in the input artifact.
