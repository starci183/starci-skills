# Frontend design maintenance

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.design-maintenance` |
| Contract revision | `7.6.0` |
| Operators | `fe/request-compile, fe/authority-reconcile, fe/source-apply, fe/visual-fidelity` |
| Search tags | `frontend, block, feedback, learning, audit, grammar, principle, reconcile` |
| Dependencies | `fe.ui, fe.grammar-common-overview`, plus selected Grammar object/case guides |

## Internal guidance

Frontend maintenance lives inside the canonical compile/apply/review machine. Maintenance
classification is an internal responsibility of those existing stages, not a helper/debt folder,
public operator, visible stage, or alternate learning route. Compile classifies owner feedback as local
drift, reusable authority gap, consumer drift, or business-truth mismatch. Apply changes only the
frozen product owner, and blind review proves the latest source. A reusable learning is promoted only
when evidence supports the relationship beyond the originating screen; rejected attempts and the
negative boundary remain recorded. Cross-surface alignment never begins from visual similarity alone.

Reusable UI learning resolves in the fixed order `AI-first -> Rules-first -> Grammar-last` defined by
`fe.ui`. A Grammar-valid result remains rejected when either earlier layer is incoherent. Promotion
updates only the smallest reusable law and never copies an example page arrangement into global
authority.

When a component library already exposes a supported public prop, variant, state or slot API for the approved behavior, use that API before adding class or CSS overrides. An override is allowed only when the public API cannot express the behavior; record the API gap, keep the override within the smallest owned boundary, and prove vendor-controlled interaction, accessibility and theme states remain intact.
