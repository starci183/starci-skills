# Source subjects and configuration inputs

The aggregate gate retains two inventories with different responsibilities:

- Source subjects are the union of the profile's source globs and the canonical
  architecture check's resolved source files. The latter includes custom roots
  and monorepo sources outside the default layout.
- Evidence inputs also include the profile's configuration/input globs. They
  remain required, available to metadata adapters, and hashed before and after
  checking so changes invalidate the result.

Architecture obligations select executable source subjects from the first
inventory. A TypeScript configuration file such as `jest.config.ts` that appears
only in input globs is not an application contract subject. Non-source metadata
can still select package/Grammar architecture obligations. Metadata scripts keep
their full declared input scope.

This is role selection, not a filename exception or suppression. If a profile
explicitly includes a file in its source globs, the architecture adapter must
cover it. Missing source coverage still blocks conformance. Custom architecture
roots remain checked, and every required configuration input remains in the
before/after snapshot.
