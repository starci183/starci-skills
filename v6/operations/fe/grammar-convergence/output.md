# Grammar convergence output

Return one JSON value that validates against `output.schema.json`.

For every selected block slot, the output either resolves one exact generic owner or records a Grammar gap. A resolved owner includes:

- its exact package, immutable version, integrity, layer and export path;
- the selected rule and template hash;
- closed anatomy and behavior invariants;
- explicitly open variable axes;
- neutral presentation-state mapping;
- the applicable complex-case row and proof references;
- its base-contract reference and hash.

The only allowed package topology is shared mechanics from `@starci/ui/common` plus exactly one routed `@starci/grammar/<id>`. A routed Grammar may use another package only through an exact dependency declared in its own locked manifest. Never infer that `core`, `miamia` or another Grammar is inherited.

Exports stay generic, for example `@starci/grammar/core/branch/SurfaceCard`, `@starci/grammar/core/branch/SurfaceListCard` or `@starci/grammar/core/composites/Sidebar`. They contain no business semantics. A complex case records how generic owners behave under difficult structural, interaction, content-count and neutral-state combinations.

An unresolved owner, state map, complex-case row, extension axis or package export becomes a named `grammar-gap`. A failed business-free gate blocks the run immediately and emits no usable selection.
