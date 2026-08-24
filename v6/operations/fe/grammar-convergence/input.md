# Grammar convergence input

Grammar convergence starts only after `OK LAYOUT <id>` binds one layout direction.

Provide one JSON value that validates against `input.schema.json`.

The input contains:

- the selected layout artifact, hash and direction ID;
- one exact `@starci/ui/common` lock and exactly one routed `@starci/grammar/<id>` lock, both with immutable versions and integrity values;
- block-level structural, interaction and presentation facts projected into a closed render-neutral vocabulary;
- neutral presentation-state IDs translated upstream by opaque Product Blocks;
- exact bundle manifests and base-contract references available to the selected route.

Do not provide actor, product entity, business operation, price, entitlement, domain state, policy or outcome. Copy may be passed only as opaque slot content and may never select a rule. The operation rejects business-bearing fields rather than learning them as new Grammar vocabulary.
