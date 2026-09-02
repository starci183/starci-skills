# Execute `test/ui-quality-audit`

## Context

Resolve only the supplied exact references with default repository or file search. Verify their frozen fingerprint and routed project identity.

## Input

Bind all work to the verified project and one bounded objective.

## Action

Issue one UI-quality verdict from a frozen immutable evidence set and perform no durable mutation. Do not route later work, own workflow state, broaden source scope, or perform another operator's job.

Require full-viewport screenshots from the latest source revision at each declared wide, intermediate, and compact viewport, then inspect the rendered images for hierarchy, density, wrapping, spacing, clipping, occlusion, balance, and coherence. DOM, computed style, accessibility, geometry, overflow measurements, lint, tests, and numeric thresholds only corroborate that visual judgment; they cannot substitute for it or independently yield `PASS`. Missing post-change screenshot review is a non-success outcome, and any visibly poor render is `FAIL` even when every measurement passes.

When the surface owns drag, page/internal scroll, sticky/fixed positioning, zoom-sensitive reflow, or overlays, require post-interaction screenshots after the applicable lifecycle in `knowledge/ui-render-review.md`. A static resting screenshot cannot prove those behaviors.

Apply the `uiq.interaction.scope-state-parity` gate to every representative interactive family. Freeze
whether the action is inline or whole-surface, then require resting, pointer-hover, keyboard
`focus-visible`, and pressed/active evidence; require selected, expanded, pending and disabled evidence
when those states are reachable. Fail when feedback leaks outside an inline target, covers only a child
of a whole-surface target, appears on a static surface, lacks keyboard parity, conflates transient
active with persistent selected/expanded state, or disappears under reduced motion. Baseline pixels,
DOM class presence, and source intent cannot pass this gate.

Audit by falsification. Require the complete adversarial probe matrix from
`knowledge/ui-render-review.md`, including viewport extremes and breakpoint-adjacent widths. Attempt
every applicable probe, and inspect the surrounding parent, preceding and following siblings, and
page terminal as well as the changed surface. A probe without fresh
raster evidence, or `not-applicable` without an exact ownership reason, is missing proof. Do not stop
at the first defect and do not issue `PASS` from a pleasant baseline, checklist completion, or green
technical gates.

For each screenshot, require an explicit visual-ownership judgment for every heading, label, status,
value, action, and control: which rendered section does a user perceive as its owner, and does that
match the intended owner without source knowledge? An external label row and its framed surface may
form one owner; DOM ancestry, component contracts, frame containment, and element existence are not
ownership proof. An object visually attached to the wrong sibling or floating between peer sections
is `FAIL`. At every sticky/fixed edge, require a pinned-boundary-clearance judgment at scroll start,
middle, and terminal. No overlap is not enough when adjacent content visibly touches or is cut off by
the pinned boundary.

## Output

Return only one atomic result: `outcome`, `resultRef`, `evidenceRefs`, `findings`, and `reason`.

## Stop

Return the applicable non-success outcome when evidence is missing, fingerprints drift, or the requested work exceeds this single job.
