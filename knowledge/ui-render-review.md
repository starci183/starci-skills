# Frontend blind render review

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui-render-review` |
| Contract revision | `7.6.0` |
| Operators | `fe/visual-fidelity` |
| Search tags | `ui, blind review, raster, composition, hierarchy, responsive, lifecycle, aesthetic veto` |
| Dependencies | `fe.ui, fe.ui-quality-review, fe.audit-loop-v75b` |

## Authority boundary

Blind review judges browser-visible UI pixels against `fe.ui`, Grammar Common, and exactly one
selected Grammar. It evaluates purpose, content coherence, composition, hierarchy, state rendering,
responsive transformation, interaction visibility, accessibility cues, and perceived finish. It does
not redesign the journey, change business truth, inspect source, or route the mission. The canonical
frontend machine owns the one permitted repair cycle and every terminal exit.

## Validated packet

Review begins only after capture/preflight validates a latest-source packet. The packet includes:

- one uncropped host-context image at the actual delivery surface and content viewport;
- a settled, populated happy-case full-page image with every major region and primary task visible;
- wide, intermediate when composition changes, and compact states;
- focused material-surface crops with adjacent context where whole-page scale hides edge detail;
- every applicable loading, pending, empty, error, denied, recovery, refresh/resume, overlay, sticky,
  bounded-scroll, zoom, focus, and drag lifecycle cell;
- opaque cell IDs and source, runtime, state, viewport, and capture fingerprints.

An empty, loading, skeleton, error, duplicate, or cropped image cannot replace the populated hero or
carry a whole-page aesthetic verdict. A screenshot clipped at a viewport edge does not prove the
partially visible owner is broken; require the adjacent scroll/focus cell. Missing applicable cells
make the packet incomplete and the verdict `BLOCKED` or `INSUFFICIENT_EVIDENCE`, never PASS.

Any source mutation, runtime generation change, handoff-state change, host geometry change, or stale
fingerprint invalidates the packet.

## Blind execution boundary

Exactly one fresh-context `gpt-5.6-sol` reviewer with `forkTurns=none`, distinct from the implementer,
receives only raster artifacts and opaque cell metadata. Withhold source, DOM, computed styles,
measurements, tests, rules, Grammar prose, feedback history, suspected defects, intended answers,
producer rationale, and prior verdicts until the pixel verdict and written observations are frozen.

DOM, accessibility trees, geometry, traces, static gates, and tests may classify a visible finding
afterward; they cannot reinterpret pixels, excuse a contradiction, or manufacture visual PASS.

## Required visual lenses

Every raster has a concrete observation and `PASSED`, `PROBLEM`, or exact `not-applicable` disposition
for each applicable lens:

- **Purpose and semantic utility:** every visible object has a recognizable job; reject placeholders,
  debug residue, duplicated controls/copy, decorative noise, orphan labels, empty shells, irrelevant
  metadata, and unavailable actions.
- **Content coherence:** identity, values, status, guidance, and actions agree and make the next step
  understandable without source knowledge.
- **Composition and hierarchy:** focal point, reading order, semantic card ownership, density,
  typography roles, action priority, whitespace, and balance are deliberate rather than a generic
  data dump or mechanically assembled grid.
- **Visual ownership:** labels, frames, rows, actions, and controls visually bind to the owner they
  name or affect through alignment, proximity, and separation from peers.
- **Surfaces and rhythm:** page inset, peer/card rhythm, card mode, edge padding, divider ownership,
  radius/border/elevation, header surface parity, and nested boundaries match the routed Grammar.
- **State and affordance:** populated/loading/pending/empty/error treatment, native destination/action
  semantics, IconTile accent, button pending treatment, state text, icons, and focus cues make one
  coherent claim.
- **Responsive and interaction resilience:** navigation, rails, mobile return/overflow access,
  sticky/fixed boundaries, scroll, zoom, overlays, and draggable controls retain reachability and
  restoration without desktop geometry leaking into compact composition.
- **Integrity and accessibility cues:** reject clipping, occlusion, bleed-through, broken z-order,
  missing edges, cropped text, unreadable wrapping, low-credibility targets, and color-only meaning.
- **Media fitness:** imagery performs an explicit orientation, explanation, identity, evidence, or
  empty-state job and remains subordinate to the task; sibling imagery alone is not a requirement.

The complete interface is judged first, then individual owners. Technically valid parts do not rescue
an incoherent whole.

## Adversarial lifecycle

The packet attempts to falsify the UI across viewport extremes and breakpoint-adjacent widths;
zoom/text scale below, at, and above baseline with restoration; page and bounded scroll at both limits
and restored; longest, shortest, missing, dense, sparse, and wrapping content; state transitions;
keyboard/focus traversal; sticky/fixed/overlay collisions; mobile navigation and drawer return; and
drag release/restoration defined by `fe.grammar-common-case-draggable-overlay-lifecycle`.

Each probe records category, owner, target state, attack, expected failure mode, raster, observed
outcome, and finding. A pretty baseline, passing checklist, measurements, or `no overflow` is never a
substitute. Complete the bounded probe matrix even after a defect so one repair batch can address the
causal cluster, unless continuing is unsafe or impossible.

## Verdict

- `PASS`: every required raster and lens passes, the populated full interface clears the aesthetic
  veto, and no contradictory finding remains.
- `FAIL`: any observable contradiction exists, including a crude, generic, wireframe-like,
  mechanically assembled, merely functional, or unpleasant complete interface.
- `SUSPENSE`: Grammar is complete, no contradiction exists, and one finite visual choice remains
  unresolved. Missing semantic rule/token/component is `grammar-gap`, not a visual verdict.
- `BLOCKED`: runtime, identity, capture, or evidence prevents a valid visual verdict.

The first visual decision is the aesthetic veto on the settled populated whole. A result that is not
immediately harmonious, polished, and pleasant is `FAIL`; correct rendering, working behavior,
responsive fit, accessibility output, or green tests cannot upgrade it.

Capture-preflight readiness is binary and never a score. A numeric rating is noncanonical and emitted
only when the user explicitly requests it, after the typed verdict. If requested, use five separately
evidenced 0-2 axes: task closure, UX state clarity, visual hierarchy/composition,
responsive/interaction resilience, and consistency/accessibility cues. Any visible contradiction
caps the rating at 8; 9+ requires typed PASS and full marks for hierarchy/composition and
consistency/accessibility. The rating never routes or softens the typed verdict.

After the verdict, classify each finding to its smallest owner with corroborating evidence. Do not
repair or recapture inside this record; return the typed review product to the canonical frontend
machine.
