# creativity

## Definition

Creativity here is the disciplined search for the clearest StarCi experience inside the product's
existing grammar. It is not permission to invent components, tokens or behavior on sight. Canon
sets the language; this folder supplies a repeatable way to ask better product questions, generate
meaningfully different answers, attack those answers and implement the strongest survivor.

The question that settles whether this workflow succeeded: **did the result make the user's next
valuable action clearer without lying about product data, state, semantics or architectural
ownership?**

Read in this order:

1. [`mode.md`](mode.md) — decide whether the reference is law or inspiration.
2. [`best-belief-source.md`](best-belief-source.md) — choose authority for each kind of claim.
3. [`research.md`](research.md) — build the evidence packet.
4. [`brief.md`](brief.md) — state the page thesis and CTA hierarchy.
5. [`divergence.md`](divergence.md) — produce genuinely different directions.
6. [`critique.md`](critique.md) — red-team each direction.
7. [`selection.md`](selection.md) — choose by gates and comparative judgement.
8. [`contract-graph.md`](contract-graph.md) — translate the winner into StarCi ownership.
9. [`implementation.md`](implementation.md) — build one evidence-backed vertical slice at a time.
10. [`verification.md`](verification.md) — prove the rendered states and interactions.

The record that carries all of this is one file per task at `<Source>/.workflows/designs/<app>/<id>.md`, appended to
by each phase and owned by none of them. Its shape is in
[`skill-shape.md`](../../skill-shape.md).

Approved product baselines are not filed here. A baseline states what ONE screen already promises
its users, which is a different kind of claim from the reasoning above and ages on a different
clock: this shelf changes when the way we decide changes, a baseline changes when that product
changes. They live in [`fe/baselines/`](../baselines/) — currently
[`explore.md`](../baselines/explore.md) for Dashboard Explore.

## Operating procedures

The documents above hold the reasoning model. Net-new UI and UI with an unresolved choice use one
mandatory approval pipeline. All phases keep `page`, `layout`, `block` and `overlay` as explicit
scopes rather than separate, competing workflows.

| Phase | Skill | Ends when |
|---|---|---|
| Plan | [`starci-fe-design-plan`](../../skills/starci-fe-design-plan/SKILL.md) | One HTML preview with two to four direction tabs is served at one URL on the first free port at 8080+, tracked by path/hash, and one tab is selected |
| Review | [`starci-fe-design-review`](../../skills/starci-fe-design-review/SKILL.md) | The selected brief, exact component tree, every public-prop migration, owner states and supporting source boundary are explicitly approved |
| Apply | [`starci-fe-design-apply`](../../skills/starci-fe-design-apply/SKILL.md) | Current source is committed as the baseline, only approved delta rows are written directly in source, and every row matches the final diff plus real page proof |

Every phase runs to the end of its own work before it speaks. What it cannot settle alone comes back
as one batched ask and the run continues on the answer; what only looks like a choice — a label, a
glyph, an ordering inside the chosen direction — is decided and recorded in a line. Whether an old
task still matches the source is asked later by
[`starci-workflow-drift-plan`](../../skills/starci-workflow-drift-plan/SKILL.md), not prevented by a seal.

A bounded defect with a binding expected result uses
[`starci-fe-fidelity-start`](../../skills/starci-fe-fidelity-start/SKILL.md), because manufacturing
alternatives around a settled parity fix wastes review and weakens the reference. Fidelity Fix
still locks context, reconfirms writes, proves full lint adoption and renders touched states. It
returns to Plan when hierarchy, CTA, behavior, ownership or reusable vocabulary needs a choice.

## Rules

**CREATIVITY-1 · Product truth comes before visual novelty.**

The user's job, available data, state transitions and next valuable action decide the page. A novel
surface that cannot name what product fact or action it serves is decoration, not design.

**CREATIVITY-2 · Canon is the creative constraint, not one option among several.**

Contract keys, tier ownership, vendor boundaries, icon policy, spacing, loading semantics and
data/action fences remain fixed while directions diverge. Constraining those variables forces the
work to become inventive in hierarchy, sequencing, disclosure and composition instead of merely
different in CSS.

**CREATIVITY-3 · Every direction must survive research, critique and rendered verification.**

An attractive first idea is a hypothesis. It becomes a design only after evidence explains it, an
adversarial pass fails to disprove it, and the browser confirms the intended hierarchy and states.

**CREATIVITY-4 · Migration and invention never share an unmarked change.**

When preserving a reference, copy it first. Any proposed improvement is recorded separately and is
not implemented until the user asks for redesign. This protects both faithful migration and later
creative work from becoming an unreviewable mixture.

**CREATIVITY-5 · Creativity operates at the highest useful level.**

Prefer changing the page story, block order, reveal strategy or CTA moment before proposing a new
leaf. The lower the proposed change sits in the tier system, the more screens it can accidentally
change and the stronger its proof must be.

**CREATIVITY-6 · Choice-bearing work has three gates and no shortcut.**

Plan freezes evidence and makes preliminary directions comparable through one disposable HTML
preview with two to four tabs, served at one URL on the first free port at 8080+. Its URL, path and
hash plus every tab status are recorded in the workflow. Review challenges the selected direction, source boundary, owner states
and acceptance evidence without editing production source. Apply commits the current target source
as its before-state, then implements the approved direction directly in final source paths and tracks
that baseline diff. A settled bounded defect is not choice-bearing work and uses Fidelity Fix;
discovering a choice moves it back to this pipeline.

**CREATIVITY-8 · Approval binds the brief and source boundary, not a parallel implementation.**

Review approval names the revision, final source boundary and state identity: route, viewport,
locale, theme, auth persona, fixture identity, owner tree, contracts, props and tokens. Apply is
correct only when its baseline diff stays inside that boundary and the same state identity produces
the approved behavior. Comparing different states is invalid evidence.

**CREATIVITY-7 · State completeness follows ownership.**

Every page, layout, block and overlay state is rendered, covered by a named integrated scenario or
excluded with evidence. Avoid a Cartesian product, but never use that restraint to hide loading,
empty, error, pending, disabled, responsive, theme, keyboard or focus behavior that the owner can
actually enter.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Start with JSX or class names | The first implementation becomes the design without product reasoning | Build the research packet and brief first |
| Treat canon as a mood board | The same product acquires a second architectural language | Keep canon fixed and vary composition within it |
| Call cosmetic variants different concepts | Colour or radius changes do not test another product idea | Vary hierarchy, sequence, disclosure, density or CTA moment |
| Mix migration fixes with redesign | Nobody can tell whether a difference is intentional | Complete parity, then propose a separately named redesign |
| Approve from a source review alone | Source legality cannot prove visual or interaction quality | Verify the rendered state matrix |

## Examples

### Constraint-led creativity

```
keep the same contract vocabulary; explore whether progress, urgency or continuity should lead the page
```

```
invent a new card and icon for each idea so the concepts look different
```

They differ in one thing: whether the exploration changes product hierarchy or merely manufactures
new visual parts.

### Migration boundary

```
port the measured legacy render, then document a separate proposal for a clearer CTA
```

```
improve the CTA while porting and describe the difference as architecture work
```

They differ in one thing: whether redesign remains reviewable.
