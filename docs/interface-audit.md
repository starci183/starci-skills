# Interface audit

`interface.audit` is the read-only diagnostic step between frontend implementation and independent acceptance.
It inspects real served-build captures produced by `interface.implement`, compares them with the exact latest
explicitly owner-accepted `interface.draw` receipt, accepted intent and the actual installed Grammar, and either
reports `no-actionable-drift` or returns repair-ready findings. It does not edit product/design/asset/Grammar
source, generate or retouch replacement renders, dispatch the repair, prove a UAT business journey, or replace
`review.verify`.

## Accepted draw lineage is the baseline

Before looking at the implementation, the audit enumerates every applicable `interface.draw` receipt and its
append-only explicit owner-acceptance events. It selects exactly the latest causally ordered explicit acceptance
for the selected scope. “Latest” comes from acceptance lineage/order, never filesystem mtime, generation time,
the current UI record, a `done` label or an agent's statement.

The selection binds and recomputes the exact draw receipt path and SHA-256, draw run ID, acceptance event ID/order,
coverage/content digest, and every selected direction image and exact prompt path/SHA-256. The latest explicit
owner acceptance outranks older canonical or generated directions. Older receipts and acceptance events remain
immutable history; they are not rewritten, relabelled or deleted. A later generated but unaccepted draw is not a
baseline and cannot silently supersede the accepted one.

Missing retained bytes, a digest mismatch, acceptance that does not identify one draw receipt, or conflicting
latest acceptances that cannot be causally ordered blocks the audit. It must not fall back to a convenient older
direction or infer acceptance from implementation similarity.

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

For every draw-backed representative cell, the audit records a side-by-side pair containing the accepted direction
path/hash and the fresh implementation capture path/hash. Pairing requires identical surface, state, viewport and
theme. The auditor may not resize, crop, recolor, retouch or regenerate either side, and a mobile image cannot stand
in for desktop or another state/theme. If an exact pair is unavailable, that cell is blocked rather than compared
approximately.

Each valid pair has separate pass/fail/inconclusive observations for:

- composition and hierarchy;
- section order;
- light-dark rhythm;
- imagery, including declared artwork slots and their visual role;
- creative intent.

A systemic loss or inversion in any of these lenses is actionable even when DOM checks, lint, unit/integration
tests and the build are green. Technical results corroborate implementation health; they never substitute for
visual equivalence or waive an unpaired, unrun, inconclusive or failed visual lens.

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

## Real artwork versus code-native interface

The accepted draw carries a region-level realization map. Use `raster-asset` for authored imagery whose identity
depends on rich texture or a retained master, such as a mascot illustration, photography, a textured planet or a
painted landscape. Use `code-native` for layout, responsive composition, cards, panels, text, controls, system
icons, borders, shadows, glows and simple geometry that semantic DOM plus installed Grammar, CSS or repository-
native SVG can represent faithfully.

The draw remains a visual baseline for both modes, but it is not permission to flatten code-native UI into a
screenshot. Conversely, matching the silhouette with CSS does not authorize replacing required branded/media
artwork. `interface.implement` records the actual binding for each region in `E/realization-check.json`, and the
audit records its verdict in `E/realization.json`. A mode substitution is a hard `realization.mode` finding, not a
creative preference.

## A symbol is a product claim

An icon or illustration is not accepted because it is attractive or because a caption explains it. Before a
prominent symbol enters an accepted draw, and again when the implementation is audited, answer all of these:

1. Which exact product concept does this form encode?
2. With its label hidden, what is the strongest plausible alternate reading?
3. Is the metaphor specific to this product, or generic stock imagery?
4. Does its visual maturity fit the audience and category?
5. Is it meaningfully distinct from sibling symbols?
6. Does the family share camera, base, material, light, scale and density?
7. Does it remain legible at the smallest required responsive size?
8. Is its realization medium truthful: rich authored imagery as `raster-asset`, simple system/action meaning as
   installed Grammar or repository-native `code-native` iconography?

A stack of coins, checklist or pencil can be readable yet still fail `symbol.fit` because it is clichéd,
childlike or too generic for an enterprise system. A set can also fail `symbol.family` when each image uses a
different camera, plinth, material language, lighting or density. A label does not rescue either failure.

One wrong asset with an already explicit symbolic direction routes to `interface.implement`. An incoherent or
creatively weak symbolic language shared across surfaces routes to `interface.draw`, then implementation and a
fresh capture audit. The auditor records the observed mismatch and route; it never silently redesigns assets.

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

## Intentional departures require an owner decision

A visible difference from the accepted `interface.draw` remains drift even when the implementer or auditor says
it was intentional. The audit cannot turn its own design opinion, a taste score, green technical checks or owner
silence into acceptance. It writes an append-only deviation case in `E/deviations.json` with a readable companion
at `E/deviation-brief.md`, bound to the exact accepted-draw hash, implementation-capture hash and matrix cell.

The case must make the disagreement inspectable later. It records the exact affected regions and measurements,
why the departure is claimed to be necessary, the user/product benefit, rules preserved and violated, the
accepted-conformant alternative, the proposed departure, accessibility/responsive/brand risks, rollback and the
exact recheck matrix. The auditor must state the strongest counterargument instead of arguing only for its own
verdict. Unsupported preference is not a rationale.

Until the owner explicitly decides that exact case, the finding stays open and the audit reports
`OWNER_DEVIATION_DECISION_REQUIRED`; it cannot return `no-actionable-drift`. Approval, rejection or a request for
revision is appended to lineage and is bound to the exact deviation-case digest plus the draw/capture hashes.
Approval establishes a new accepted-direction lineage input for a later implementation and audit round. It does
not retroactively let the audit waive the old baseline or rewrite the prior diff. This makes the full argument and
decision queryable when the owner asks why the implementation diverged.

`no-actionable-drift` requires exact and unambiguous accepted-draw lineage, every required exact-cell side-by-side
lens to pass, every hard cell to pass, valid installed-Grammar authority, a calibrated `ship` taste verdict and
zero open/unchanged/new/reopened/blocked actionable findings. It completes only the audit operations record.
`review.verify` independently decides acceptance from fresh selected evidence, while `uat.verify` separately
exercises ordered business journeys and persistence/cleanup where required.
