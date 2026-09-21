# Interface audit

`interface.audit` is the read-only diagnostic step between frontend implementation and independent acceptance.
It inspects real served-build captures produced by `interface.implement`, compares them with accepted intent and
the actual installed Grammar, and either reports `no-actionable-drift` or returns repair-ready findings. It does
not edit product/design/asset/Grammar source, generate or retouch replacement renders, dispatch the repair, prove
a UAT business journey, or replace `review.verify`.

## The bounded loop

```text
interface.draw seed -> interface.implement (code + real captures) -> interface.audit (inspect only)

bounded implementation drift -> interface.implement -> fresh captures -> interface.audit
systemic/direction/creative drift -> interface.draw revision -> interface.implement -> fresh captures -> interface.audit
```

The kernel assigns and enforces audit rounds 1 through 5. Round 1 freezes the selected
route x state x viewport x theme matrix. Every later audit reruns that same matrix on the new served revision;
newly reachable cells may be added, but old cells cannot disappear. The evidence links each attempt to its
immediate predecessor and records resolved, unchanged, new and reopened signatures plus measurement deltas.

No progress means the claimed repair produced no relevant served-revision change or did not resolve/diminish an
actionable finding. Oscillation means a resolved signature reopens or a measurement alternates beyond its stated
tolerance. Both are failed trends, not reasons to narrow the matrix. If round 5 still has a known finding, the
result is failed. If required intent, Grammar authority, runtime or instrumentation is unavailable, it is blocked.
There is no sixth audit and no last-round courtesy pass.

## Hard observations and bounded judgement

Every selected cell receives deterministic checks:

- geometry: rectangles, alignment, occlusion, overflow, scroll owner, target size and state/layout shift;
- content: accepted copy/data/state claims, truncation, ordering and accessible equivalents;
- icons/assets: declared source/master, hash or export identity, slot, semantic role, alt/announcement, aspect,
  crop and load result;
- responsive behavior: declared container/viewport owner, recomposition, reading/focus order, reachability and no
  clipping or page-level inline overflow;
- interactions: resting, hover, focus, active, disabled, pending, error/success and reduced-motion outcomes;
- Grammar anatomy/tokens: containment, slots, state attributes and computed border, surface, shadow and radius,
  each traced to its winning declaration/token and compared with a matching real reference render;
- applicable accessibility, contrast, focus, motion, render-truth and brand rules.

Only then does the auditor score applicable `TASTE-1..TASTE-12` rows and compute `TASTE-13`. Every score needs its
named measurement, and the same auditor scores the low/mid/high calibration anchors in the same round. A missing
measurement or invalid calibration makes taste incomplete. A `fix-first` result is actionable, but taste cannot
turn a hard failure into pass.

### Border regression example

Assume the consuming lockfile resolves a card primitive to Grammar version `4.7.2`. Its matching reference render
at the audited props/state/theme has `border-style: none` and `border-width: 0`; the reference anatomy and token
graph declare no border. The product render has `border-width: 1px` from an application selector.

That is a hard `grammar.anatomy` finding. Evidence includes the package/version and resolved entry, reference
render, product capture, element identity, computed styles, winning application declaration, matrix cells and
affected paths. It stays failed even if the border looks better, the page earns a taste score of 5, or a reviewer
prefers outlined cards. Aesthetic opinion cannot waive Grammar anatomy. The primary route is normally
`interface.implement`, followed by fresh real captures and the same matrix audit. If the desired treatment or
wider composition is genuinely undecided across the product, route a detailed `interface.draw` revision first.

A screenshot alone cannot establish this finding: antialiasing, a shadow or a neighbouring surface can resemble a
border. The audit requires actual installed Grammar identity, matching anatomy/reference and computed
declaration/token provenance.

## Finding and routing contract

Every finding uses `starci/interface-audit-finding@1` and carries a stable signature, category, hard-versus-rubric
class, rule refs, matrix cells, expected/observed values, measurements/tolerances, evidence, attribution, severity,
status, root cause, blast radius and routing. Routing includes the primary op, rationale, affected paths, exact
recheck matrix and next chain.

Root cause and blast radius outrank raw finding count. One shared direction defect may be systemic; ten unrelated
local mismatches may still have explicit bounded implementation owners.

- Use `interface.implement` when accepted intent and Grammar are clear and the smallest repair is bounded
  application content, assets, component usage or styles.
- Use `interface.draw` when intent is missing/contradictory, the result is generically or systemically wrong, the
  calibrated rubric is creatively inadequate across selected primary surfaces, or coverage/composition needs a
  new detailed direction.
- Mention `code.refactor` only as optional secondary mechanics when a structural change is behavior-invariant and
  an existing regression can run unchanged before and after. It is not the normal visual repair route.

Every route returns through `interface.implement`, which codes the repair and captures the real route x viewport
matrix. `interface.audit` only inspects those fresh captures. Reusing pre-repair captures, model-generating a
replacement, or having the auditor edit the surface invalidates the round.

`no-actionable-drift` requires every hard cell to pass, valid installed-Grammar authority, a calibrated `ship`
taste verdict and zero open/unchanged/new/reopened/blocked actionable findings. It completes only the audit
operations record. `review.verify` independently decides acceptance from fresh selected evidence, while
`uat.verify` separately exercises ordered business journeys and persistence/cleanup where required.
