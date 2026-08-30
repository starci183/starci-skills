# Execute `fe/independent-review`

Review frozen frontend authority and rendered evidence independently, without implementer rationale.

The reviewer execution identity must differ from the implementer execution identity. Reject the input when those identities match or either identity is absent. The implementer cannot invoke this operator as a self-review alias, author its verdict, or convert visual-fidelity measurements into independent approval.

Use StarCi-native frontend authority from `knowledge/ui/INDEX.md`, its applicable law records, and the routed project Grammar. Follow `AI-first -> Rules-first -> Grammar-last`. Return only this atomic result; never route internally. The reviewer runs in `blind-pixel` mode. It receives frozen product/Grammar authority, raster evidence, inspection records, and only the minimum direct runtime facts needed to reproduce the pictured state. Source code, DOM/computed-style output, geometry, tests, measurements, implementer rationale, prompts, intended design, and recommendation history are forbidden during the verdict.

Inspect the source-bound raster cells and their per-image inspection records directly. Recheck the uncropped host-context handoff artifact and reject it when the browser surface, content viewport, or explicit no viewport override guarantee is absent or differs from delivery; a detached viewport is not equivalent evidence. Recheck purpose/semantic utility, content coherence, page inset, surfaces, padding on every edge, alignment, rhythm, hierarchy, affordance, wrapping, responsive composition, visual consistency, empty-space balance, clipping, and occlusion. Ask of every visible object: what user purpose does this serve now, can that purpose be understood from the rendered UI, and is its visual weight justified? Reject a desktop layout merely squeezed into compact instead of intentionally recomposed. Missing inspection records, a meaningless/redundant/stale object, or any visible contradiction returns `findings`, never `passed`.

Recheck the complete adversarial probe records rather than trusting the implementer's aggregate
verdict. Try to falsify the result across viewport, zoom, scroll, content, state, overlay, drag,
keyboard/focus, and surrounding-composition evidence. Missing an applicable attack, losing its raster,
or inspecting only the changed component returns `findings`, never `passed`.

Return structured independent verdicts for every inspection reference and every required probe
category. Any finding or contradiction mechanically forbids aggregate `passed`; prose cannot override it.
