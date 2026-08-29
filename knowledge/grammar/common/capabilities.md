# Grammar Common object capabilities

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-capabilities` |
| Package | `@starci/grammar/common` |
| Operators | `grammar-convergence` |
| Search tags | `object, interface, export, anatomy, variants, extension axes, invariants` |
| Dependencies | `fe.grammar-common-overview` |

Resolve every object from the exact installed public export before using it. Record package, version, integrity, export path, export name, layer, and interface hash. Never infer an export or prop from a screenshot or guide.

For each object, resolve:

| Interface part | Required evidence |
| --- | --- |
| Responsibility | The one presentation or interaction responsibility owned by the object. |
| Required anatomy | Parts that must exist, their order, and their owner. |
| Optional anatomy | Parts that may disappear without leaving broken spacing or behavior. |
| Content | Allowed text, media, collections, actions, slots, and cardinality. |
| Variants | Declared structural or emphasis variants only. |
| States | Supported neutral states and their visual/interaction owner. |
| Interaction | Trigger, focus, keyboard, dismissal, selection, loading, and disabled behavior. |
| Composition | Allowed parents, children, peers, and nesting depth. |
| Responsive | Wrap, stack, collapse, clip, overflow, or alternate object rules. |
| Extension axes | Exact slots, tokens, adapters, or composition points open to application code. |
| Closed invariants | Anatomy, semantics, accessibility, dependencies, and behavior that cannot change. |

Leaves own one atomic responsibility. Branches own a small stable anatomy. Composites coordinate branches around a generic interaction model. Product Blocks and above belong to the application and may bind business data without altering package-owned anatomy.

If a required interface part cannot be proven, classify the requirement as `grammar-gap` rather than completing it from intuition.
