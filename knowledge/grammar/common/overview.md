# Grammar Common overview

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-overview` |
| Contract revision | `7.6.0` |
| Package | `@starci/grammar/common` |
| Operators | `fe/authority-reconcile` |
| Search tags | `grammar, common, package, routing, business-free, object ownership` |
| Dependencies | exact installed package version |

Common is the business-free base shared by every StarCi Grammar. It defines stable object responsibilities, neutral state vocabulary, composition boundaries, and interface language. The selected Grammar supplies its own rendering treatment and complex-case rules.

Load Common with exactly one selected package:

```text
@starci/grammar/common + @starci/grammar/core
@starci/grammar/common + @starci/grammar/offset-pop
```

Never mix Core and Offset Pop in one application Grammar decision. The installed package manifest, public exports, capabilities, components, tokens, styles, and runtime behavior are authoritative; this guide only explains usage.

Route additional Common knowledge by need:

- Semantic composition inventory and brainstorm filtering: `fe.grammar-common-semantic-composition`.
- Semantic color roles and accent ownership: `fe.grammar-common-semantic-color`.
- Interface or object identity: `fe.grammar-common-capabilities`.
- Neutral states or interaction semantics: `fe.grammar-common-states-accessibility`.
- Nested surfaces: `fe.grammar-common-case-surface-inside-surface`.
- Collection size and repeated rows: `fe.grammar-common-case-collection-cardinality`.
- Sticky or multiple scroll regions: `fe.grammar-common-case-sticky-scroll-owner`.
- Small-screen boundary changes: `fe.grammar-common-case-responsive-flattening`.
- Draggable floating controls: `fe.grammar-common-case-draggable-overlay-lifecycle`.
- Ranked rows, placement marks, and movement delta: `fe.grammar-common-case-ranked-collection-semantics`.
- Reuse, extension, or missing capability: `fe.grammar-common-extension`.

Grammar must never own an actor, product entity, price, entitlement, policy, workflow outcome, or
business-named state. Application blocks and composites map domain meaning to published Grammar
authority. They may own business-specific anatomy and ordering, but may not reconstruct generic
buttons, copy hierarchies, fields, surfaces, navigation, rails, workspaces, or responsive behavior.
Any proposed new public Grammar interface requires explicit teacher approval before source mutation.
