# Source subjects and configuration inputs

The aggregate gate retains two inventories with different responsibilities:

- Source subjects are the union of the profile's source globs and the canonical
  architecture check's resolved source files. The latter includes custom roots
  and monorepo sources outside the default layout. Explicit input-glob matches
  retain their configuration role even when a broad TypeScript program includes
  them; an explicit source-glob match takes precedence when both roles are
  declared. Thus custom production roots stay checked without treating every
  TypeScript configuration file as application code.
- Evidence inputs also include the profile's configuration/input globs. They
  remain required, available to metadata adapters, and hashed before and after
  checking so changes invalidate the result.

Architecture obligations select executable source subjects from the first
inventory. A TypeScript configuration file such as `jest.config.ts` that appears
only in input globs is not an application contract subject. Non-source metadata
can still select package/Grammar architecture obligations. Metadata scripts keep
their full declared input scope.

An authored machine check may select `sourceOnly: true` for a source script or
ESLint obligation. Its path applicability then intersects the source-subject
inventory, including canonical custom roots. The setting does not remove any
file from required inputs, snapshots, or adapter context. Metadata adapters omit
this setting so their configuration subjects remain checked. The selected Nest
error-family and Next error-state source adapters use this distinction; a root
`jest.config.ts` supplied only as configuration cannot become an application
error-family subject. A non-boolean setting or unsupported machine kind is an
invalid obligation, not a silently ignored option.

Script adapters receive `sourceContextFiles` as the complete source-role set
alongside `contextFiles` containing all evidence inputs. A source adapter must
not promote a configuration-only TypeScript file into an application subject
merely from its extension. ESLint obligations without `sourceOnly` can explicitly
select configuration inputs; those files then receive real effective-config and
lint execution. Missing configuration or uncovered obligations can never produce
a clean aggregate result.

This is role selection, not a filename exception or suppression. If a profile
explicitly includes a file in its source globs, the architecture adapter must
cover it. Missing source coverage still blocks conformance. Custom architecture
roots remain checked, and every required configuration input remains in the
before/after snapshot.
