# Evidence must prove the rendered result

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui.evidence` |
| Operators | frontend capture, visual review, finding classification, and proof |
| Search tags | `raster, probe, visual pass, falsification, invalidation, clipping, occlusion` |
| Dependencies | `fe.ui`; `fe.ui-render-review`; routed Grammar |

UI conformance is proved from the latest rendered pixels and interaction evidence for required states
and viewports. Source inspection, component ancestry, DOM geometry, measurements, lint, tests, or a
previous raster may diagnose a finding but cannot issue visual `PASS`.

Try to falsify hierarchy, ownership, empty-space balance, wrapping, clipping, occlusion, semantic
utility, affordance, responsive composition, keyboard/focus traversal, state transitions, scroll
limits, and terminal boundaries. A mutation invalidates affected evidence. Classify each confirmed
contradiction to the smallest owner in [`INDEX.md`](INDEX.md), repair that owner, and reproduce the
same proof.
