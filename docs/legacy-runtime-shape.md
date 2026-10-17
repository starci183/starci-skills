Owner: knowledge/hfs/rules.yaml

# Runtime source ownership and layout

These runtime repository rules use the same source ownership, tiers and naming standard for lite and full. The runtime manifest supplies the owners and parameters; the dedicated runtime shape spec contains passing and violating source examples for each edition.

## External owner

`RT_EXTERNAL_OWNER` reports an owned module import, external program or global used outside the owner named by the runtime manifest. Put a Git process call in its Git API owner and call that API from domain code. A local binding named `fetch` remains ordinary local code.

## Tier direction

`RT_TIER_DIRECTION` reports a relative import whose target tier is absent from the importing tier's `mayImport` list. A base helper cannot import a kernel owner; a kernel owner may import base helpers and API calls. A missing relative target also fails because its owner direction cannot be established.

## Base purity

`RT_BASE_IMPURE` reports filesystem writes in the base tier and environment reads outside a declared environment seam. Pass values into base helpers, keep filesystem reads read-only, and use the manifest's explicit seams for environment access. A seam permits environment reads but never filesystem writes.

## API shape

`RT_API_SHAPE` reports an API call file that exports anything besides its one function named in camelCase after the filename. It also reports imports between API systems, access to another system's runner, missing relative targets and call files absent from a declared calls contract. An API call may use its own system's runner; domain code composes calls from different systems.

## Spec placement

`RT_SPEC_PLACEMENT` refuses every runtime test (owner ruling `no-runtime-specs`): a spec or test file is allowed only as a package spec beside package source (the `.spec.` suffix, never `.test.`), inside `examples/`, or as one of the declared scaffold e2e files under `e2e/` (slot `runtime.e2e`). Any other spec or test file, in `scripts/`, `engine/`, `modules/`, `ui/` or a `tests/` directory, is refused.

## Source name

`RT_SOURCE_NAME` reports source names outside kebab case, temporary or one-off names declared by the manifest, and repeated basenames within one tier. Choose a durable, distinct module name. The manifest permits shared runner and index basenames, and the same basename may occur in different tiers.
