# Frontend design maintenance

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.design-maintenance` |
| Operators | `block-reconcile, maintenance-apply, learning-request, request-review, learning-resolve, surface-audit, authority-reconcile, consumer-align` |
| Search tags | `frontend, block, feedback, learning, audit, grammar, principle, reconcile` |
| Dependencies | `fe.ui, fe.grammar-common-overview`, plus selected Grammar object/case guides |

## Record

Frontend correction is source-first: reconcile the exact block/page boundary, apply and prove concrete feedback, then record a durable learning request. Learning resolution separately audits the correction, preserves rejected attempts, updates the smallest Grammar or Principle authority, and closes with proof. Cross-surface audits distinguish local drift, systemic authority gap, consumer drift, and business-truth mismatch before any bulk alignment.

Reusable UI learning resolves in the fixed order `AI-first -> Rules-first -> Grammar-last`. `AI-first` binds the approved product meaning, information priority, evidence density, and whether synthesis materially helps; it does not require generated AI copy. `Rules-first` owns hierarchy, surface responsibility, data semantics, nesting, responsive persistence, and recovery/state presentation. `Grammar-last` maps that accepted composition to one selected Grammar's exact objects, variants, tokens, padding, gap, and type treatment. A Grammar-valid result remains rejected when either earlier layer is incoherent. Promote only the smallest reusable law and preserve a negative boundary against copying the originating screen as a universal template.

When a component library already exposes a supported public prop, variant, state or slot API for the approved behavior, use that API before adding class or CSS overrides. An override is allowed only when the public API cannot express the behavior; record the API gap, keep the override within the smallest owned boundary, and prove vendor-controlled interaction, accessibility and theme states remain intact.
