# Frontend UI render review

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui-render-review` |
| Operators | `test/ui-audit` |
| Search tags | `ui, render, composition, hierarchy, responsive, overflow, accessibility, suspense` |
| Dependencies | `fe.ui, fe.ui-quality-review` |

## Boundary

UI Audit evaluates browser-observable composition, hierarchy, data presentation, state rendering, responsive transformation, overflow, focus visibility, accessible name/role/state, contrast, and fidelity to `fe.ui` plus Grammar Common and exactly one selected Grammar. It cannot redesign task order, interaction container choice, API behavior, or business outcome.

Each case freezes a render-state matrix and proves every cell using full-viewport screenshots plus direct DOM, computed-style, accessibility, geometry, or trace evidence. The matrix crosses all in-scope entry, task, pending, recovery, result, exit, and exact handoff states with every required viewport. The exact handoff cell also owns one uncropped host-context screenshot captured from the browser surface the user will actually see, at its current content viewport, with no viewport override. A detached automation viewport, a resized emulation, or a browser-only raster cannot certify an in-app panel whose visible host geometry differs. Record the host surface identity and exact content width/height beside that artifact; if either changes before handoff, recapture and rereview. An overlay image does not prove the obscured surface beneath it; a task-state image does not prove a different state left visible at handoff. Existence of a node or a pretty screenshot is not proof of visibility, meaning, hierarchy, reachability, or correct Grammar identity.

Full-viewport screenshots are the primary evidence for visual composition. The enforced loop is `apply/repair -> capture the complete matrix -> inspect the images -> repair on any contradiction -> recapture`. After every implementation or repair, the reviewer must capture the exact wide, intermediate, and compact renders and inspect the images themselves for hierarchy, density, wrapping, spacing, clipping, occlusion, balance, and overall coherence before issuing a verdict. DOM existence, computed styles, element rectangles, overflow measurements, CSS tests, accessibility output, lint, tests, and numeric thresholds are corroborating evidence only; none can substitute for image-based visual judgment or independently produce a visual `PASS`. A numerically valid render that looks cramped, unbalanced, obscured, or plainly poor is `FAIL`. Any source or handoff-state change stales prior screenshots. If the screenshots were not captured and actually reviewed after the latest source change, the visual review is incomplete and cannot close.

Every screenshot cell owns a written inspection record before aggregation. The visual verdict is a blind pixel review: while judging the image, ignore source code, DOM/computed styles, test output, measurements, implementation rationale, and claimed intent. They may be used only after a visible finding to locate its cause. They cannot excuse, reinterpret, or upgrade the rendered result.

The blind verdict is executed by exactly one fresh-context `gpt-5.6-sol` reviewer with `forkTurns=none`; the reviewer identity must differ from the implementation identity. Its only visible input is the raster packet: an uncropped host image, focused material-surface images with adjacent context, responsive/lifecycle/probe rasters, opaque cell labels, and capture fingerprints. Do not provide source, DOM, measurements, rules, Grammar, feedback history, suspected defects, prior verdicts, producer rationale, or intended answers. A single distant whole-screen image is insufficient because local padding, ownership, density, and clipping can disappear at that scale.

Record visible observations for all of these lenses:

- **Purpose and semantic utility:** every visible object has a user-recognizable job in this state. A meaningless object has no understandable user purpose in the rendered state. Flag debug residue, placeholders, duplicated controls or copy, decorative noise, orphan labels, empty shells, irrelevant metadata, controls without an available action, and anything whose prominence exceeds its usefulness.
- **Content coherence:** labels, values, status, guidance, and actions agree with one another and with the visible task. The user should not need source knowledge to understand what happened or what to do next.
- **Composition and hierarchy:** focal point, reading order, grouping, density, typography, action priority, balance, and whitespace make the task scannable. Blank space must separate or focus content; a large dead zone, accidental moat, stranded control, or visually competing primary action is a contradiction.
- **Visual ownership:** assign every visible heading, label, value, status, action, and control to the rendered section owner it appears to name, describe, or control. Inspect that object together with its intended owner and the preceding and following peer sections. A section owner may legitimately comprise an external label row plus its framed surface; frame containment is not ownership. A user without source knowledge must still bind the label and frame together through alignment, proximity, and separation from adjacent owners. DOM ancestry, component intent, or mere existence inside a layout cannot prove or disprove this relationship; an object visually attached to the wrong sibling or floating between owners is a contradiction.
- **Surfaces and spacing:** outer page inset, surface opacity or intentionally frameless treatment, content-to-border padding on every edge, peer-edge alignment, vertical rhythm, border/radius/shadow ownership, and nested-surface consistency are visibly complete. Audit each edge, not just the easiest one.
- **Pinned-boundary clearance:** for every sticky, fixed, or otherwise pinned edge, inspect the nearest visible content and surface at scroll start, middle, and terminal. “No text overlap” is insufficient: the pinned owner and adjacent content must retain an intentional breathing boundary from the applicable composition authority. A surface touching a pinned edge, appearing cut off beneath it, or ending flush against it is a contradiction even when all content remains technically readable. Do not assume one numeric token globally; resolve the spacing from the owning page/Grammar composition.
- **Affordance and legibility:** interactive objects look interactive; disabled, pending, selected, destructive, and primary states are distinguishable; text contrast, line length, wrapping, truncation, icons, and touch/click targets are visually credible.
- **Responsive composition:** each viewport has an intentional composition, not a wider layout squeezed or clipped. Priority, grouping, action placement, navigation, readable width, and terminal whitespace remain coherent when compact or expanded.
- **Integrity:** reject clipping, overlap, bleed-through, accidental transparency, broken z-order, sticky/fixed occlusion, missing edges, cropped text, and controls that appear detached from their owner.

`Not applicable` must name why. A record containing only dimensions, DOM facts, accessibility facts, `no overflow`, `looks good`, or a checklist without concrete pixel observations is invalid. Text touching a border or edge, content showing through a sticky/fixed surface, and every other contradiction in any lens force `FAIL`/`repair`; technical reachability and passing code evidence cannot cancel them.

Static screenshots at scroll origin do not prove an interactive surface. Skeleton, loading, pending,
empty, recovery, and steady content are separate visual states and cannot share a verdict. Exercise
every applicable lifecycle after the latest source mutation: page scroll at start/middle/end and
back; each bounded scroll owner at both limits and restored; draggable controls released against every
constraint edge; browser zoom-in, zoom-out, and restored baseline; sticky, fixed, overlay, and focus
behavior before and after those changes. Capture and run AI visual-fidelity on every resulting state.
Reject off-screen or unrecoverable controls, scroll bleed, stale drag transforms, sticky occlusion,
clipped content, accidental overlap, and any state that changes owner when the viewport or zoom
changes. Skip only states or interactions the resolved surface does not own, and record the exact
inapplicability reason.

The lifecycle explicitly covers page scroll at start/middle/end and back before its verdict may pass.
It also covers draggable controls released against every constraint edge.
Browser zoom/text scaling must pass zoom-in and zoom-out before the baseline is restored.

Review is AI-led adversarial falsification, not confirmation. The AI begins with pixels and actively
tries to discover potential UX/UI defects. For every screenshot it must challenge at least one
purpose/content hypothesis, one composition/spacing hypothesis, and one interaction/responsive
hypothesis, then give each required visual lens its own verdict. A top-level PASS cannot override a
confirmed challenge or a problem lens.

Only after a potential defect is recorded may the workflow inspect `knowledge/ui/INDEX.md`, its applicable law records, routed Grammar,
source, DOM, or measurements to classify the smallest owner: implementation, reusable UI knowledge,
Grammar, product authority, or another domain. Those authorities guide the repair; they cannot erase
the pixel finding. Every repair invalidates the raster and restarts AI review without the previous
rationale. If the same potential problem persists, reclassify the owner rather than repeatedly tuning
the implementation around a possibly wrong Grammar or rule.

Before capture, freeze an adversarial probe
matrix and try to break the UI across every category: viewport extremes and breakpoint-adjacent
widths; zoom/text scale below, at, and above baseline with restoration; page scroll at start, middle,
end, and back; every bounded or nested scroll owner at both limits plus scroll-bleed attempts;
longest, shortest, missing, dense, sparse, and wrapping content; closed/open, loading, pending, error,
empty, disabled, selected, recovery, and other material transitions; sticky, fixed, and overlay
collisions at viewport edges and terminal boundaries; drag release at every constraint edge and
restoration; keyboard/focus traversal; and composition around the change, including its parent,
preceding and following siblings, and page terminal. Each category is either attempted with latest-
source raster evidence or marked `not-applicable` with an exact ownership reason.

For every probe, record its category, target state, attack attempted, expected failure mode, image
reference, observed outcome, and concrete finding. Do not stop at the first defect: finish the bounded
probe matrix so repair can address a causal cluster, unless continuing is unsafe or impossible. A
pretty baseline screenshot, passing checklist, test suite, or collection of measurements cannot
produce `PASS`. Missing any applicable probe is incomplete proof and therefore never `PASS`.

Blind review is an execution boundary, not a second paragraph written by the implementer. Without the distinct fresh Sol identity, raster-only packet, one inspection record per raster, and an explicit verdict for the final post-mutation screenshot, the result is incomplete and never `PASS`.

With `debug=true`, terminal output includes `[AI REVIEW][image: ...]`, all `[FINDING][lens] ...` observations, and `[VERDICT] ...` for every raster, plus the normalized AI CALL/RETURN/TRANSITION contracts. Missing a raster block is missing proof, not a logging inconvenience.

Audit in the fixed order `AI-first -> Rules-first -> Grammar-last`:

- `AI-first` observes whether approved identity, evidence, status and next action have a coherent priority, and whether any synthesis is justified by density or decision complexity. Do not require AI copy for simple content and do not invent product meaning.
- `Rules-first` observes reading order, semantic hierarchy, data representation, surface and collection ownership, nesting, responsive persistence and state/recovery presentation. Prove a destination with native link semantics and a real non-null href, preserve contract-declared progress as a progress presentation, and reject any compact numeric fact whose visible rank equals or exceeds its owning section title.
- `Grammar-last` proves exact Grammar object/interface identity, variants, padding, gap, typography, separators, state marks and responsive treatment only after the earlier observations are recorded.

Verdicts are `PASS`, `FAIL`, `SUSPENSE`, and `BLOCKED`. Record separate verdicts and evidence for all three layers before aggregating. A contradiction in any layer makes the UI verdict `FAIL`, even when another layer passes or is missing. `SUSPENSE` is legal only when no layer fails and one finite render choice remains unspecified or conflicts. Record exact surface/state/viewport, authorities checked, finite question, and owner. Runtime unavailability is `BLOCKED`; observable contradiction is `FAIL`; uncertainty outside UI is routed to its owner.
