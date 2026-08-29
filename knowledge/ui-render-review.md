# Frontend UI render review

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui-render-review` |
| Operators | `test/ui-audit` |
| Search tags | `ui, render, composition, hierarchy, responsive, overflow, accessibility, suspense` |
| Dependencies | `fe.ui, fe.ui-quality-review` |

## Boundary

UI Audit evaluates browser-observable composition, hierarchy, data presentation, state rendering, responsive transformation, overflow, focus visibility, accessible name/role/state, contrast, and fidelity to `fe.ui` plus Grammar Common and exactly one selected Grammar. It cannot redesign task order, interaction container choice, API behavior, or business outcome.

Each case proves all reachable selected states at required viewports using full-viewport screenshots plus direct DOM, computed-style, accessibility, geometry, or trace evidence. Existence of a node or a pretty screenshot is not proof of visibility, meaning, hierarchy, reachability, or correct Grammar identity.

Audit in the fixed order `AI-first -> Rules-first -> Grammar-last`:

- `AI-first` observes whether approved identity, evidence, status and next action have a coherent priority, and whether any synthesis is justified by density or decision complexity. Do not require AI copy for simple content and do not invent product meaning.
- `Rules-first` observes reading order, semantic hierarchy, data representation, surface and collection ownership, nesting, responsive persistence and state/recovery presentation. Prove a destination with native link semantics and a real non-null href, preserve contract-declared progress as a progress presentation, and reject any compact numeric fact whose visible rank equals or exceeds its owning section title.
- `Grammar-last` proves exact Grammar object/interface identity, variants, padding, gap, typography, separators, state marks and responsive treatment only after the earlier observations are recorded.

Verdicts are `PASS`, `FAIL`, `SUSPENSE`, and `BLOCKED`. Record separate verdicts and evidence for all three layers before aggregating. A contradiction in any layer makes the UI verdict `FAIL`, even when another layer passes or is missing. `SUSPENSE` is legal only when no layer fails and one finite render choice remains unspecified or conflicts. Record exact surface/state/viewport, authorities checked, finite question, and owner. Runtime unavailability is `BLOCKED`; observable contradiction is `FAIL`; uncertainty outside UI is routed to its owner.
