# Grammar Common overview

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-overview` |
| Package | `@starci/grammar/common` |
| Operators | `grammar-convergence` |
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

- Interface or object identity: `fe.grammar-common-capabilities`.
- Neutral states or interaction semantics: `fe.grammar-common-states-accessibility`.
- Nested surfaces: `fe.grammar-common-case-surface-inside-surface`.
- Collection size and repeated rows: `fe.grammar-common-case-collection-cardinality`.
- Sticky or multiple scroll regions: `fe.grammar-common-case-sticky-scroll-owner`.
- Small-screen boundary changes: `fe.grammar-common-case-responsive-flattening`.
- Reuse, extension, or missing capability: `fe.grammar-common-extension`.

Grammar must never own an actor, product entity, price, entitlement, policy, workflow outcome, or business-named state. Application Product Blocks map domain meaning to neutral Grammar state.
