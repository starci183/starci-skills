# UI decision authority

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui` |
| Operators | `principle-compile` |
| Search tags | `ui, principles, grammar, composition, spacing, hierarchy, responsive, render decision, suspense, destination, link, href, progress, fact rank` |
| Dependencies | `fe.layout-composition, fe.grammar-common-overview`, plus exactly one selected Grammar and only its triggered object/case guides |

## Authority

UI decision authority binds every render decision, including whether `SUSPENSE` is legal, to two authorities together: `fe.ui` plus Grammar Common and exactly one selected Grammar.

1. this `fe.ui` record owns cross-object composition and decisive presentation rules;
2. Grammar Common plus exactly one selected Grammar owns object rendering, visual language, supported states, tokens, variants and triggered complex cases.

Neither authority is optional. Never mix selected Grammars in one application decision, and never invent a local visual convention when the selected Grammar already owns that axis.

## Decision boundary

This knowledge decides only the UI layer: region composition, hierarchy, density, span, grouping, nesting, alignment, spacing, responsive transformation, visual state treatment and the presentation of interaction affordances.

It does not decide:

- the customer journey, task order, recovery strategy or whether a step belongs in a page, modal or realtime flow; those are UX decisions;
- business rules, authorization, API semantics, persistence, events or data correctness; those are Behavior decisions;
- which product facts or states exist; UI renders the approved neutral facts and reachable states supplied upstream.

Do not use UI preference to overrule UX or Behavior evidence.

UI direction begins only after the UX flow and interaction-container plan are frozen. Proactively enumerate every reachable presentation state exposed by UX—populated, empty, pending, validation, denied, error, recovery, long content, refresh/resume, and material responsive branches—before implementation. User feedback should be promoted into the smallest reusable UI or Grammar rule and applied to every matching state/consumer, not patched only where the symptom was first seen.

## Three-layer decision order

Every UI decision runs in this order and records one independent verdict per layer:

1. `AI-first`: bind the approved business-visible meaning, decide what the user must notice first, distinguish evidence from supporting metadata, and decide whether density or decision complexity benefits from synthesis. This is a reasoning gate, not a requirement to generate AI content; simple label-content and short-list data stay direct.
2. `Rules-first`: validate reading and action order, hierarchy, semantic data presentation, surface ownership, collection ownership, nesting, responsive persistence, and reachable state treatment. Reject contradictory metrics, misleading progress encodings, redundant emphasis, uniform spacing that erases relationships, and a supporting block that visually dominates stronger evidence.
3. `Grammar-last`: only after the first two layers pass, bind the composition to Grammar Common plus one selected Grammar's exact object, variant, token, padding, gap, typography, and responsive treatment.

A failure in any layer makes the UI decision fail. Grammar conformance cannot rescue an incoherent meaning or composition, and an attractive composition cannot bypass an exact Grammar violation. Preserve approved upstream facts and journey behavior; these layers decide presentation, not new product truth.

## Required decision

For every UI situation, emit one explicit decision containing:

- `Situation`: exact surface, region, state and viewport;
- `Decision`: what must render and how it is composed;
- `Grammar binding`: Common plus the selected Grammar object/case rule that owns the treatment;
- `Implementation intent`: the observable structure, alignment, density or responsive behavior;
- `Negative boundary`: what must not be rendered or inferred;
- `Proof`: runtime evidence at the required states and viewports.

Current source is evidence, not authority. A component that already renders does not pass merely because it exists.

## UI verdict

- `PASS`: `AI-first`, `Rules-first`, and `Grammar-last` each pass at every required state and viewport.
- `FAIL`: runtime evidence contradicts any applicable meaning-priority, UI composition, or Grammar rule. One layer's success cannot hide another layer's failure. Fix the owning FE/BE source, then retest the same case.
- `SUSPENSE`: neither authority fails, but no applicable rule exists, required authorities conflict, or the authority does not specify enough to decide how the state should render.

`SUSPENSE` is not a stylistic guess, not runtime `BLOCKED`, and never counts as PASS. Record the exact unresolved render question, request owner feedback, update the smallest UI/Grammar authority, then rerun the case. The calibration goal is `NO SUSPENSE`.

## Composition

Give every meaningful region one clear owner. A child collection receives a distinct nested surface only when it owns a repeated schema, row boundaries, state or interaction boundary; decoration alone never justifies nesting. Removing the child surface must make grouping or ownership ambiguous, otherwise the nested surface is unnecessary.

Separate dense subjects when they have different decisions, states or scan patterns. Preserve one obvious reading order and one obvious primary-action order. Supporting information stays visible without competing with the primary task.

Treat media as information architecture, not decoration. After editing copy into the shortest useful
headings, summaries, steps, examples, or checklists, decide whether a visual would still materially
improve orientation, recognition, explanation, comparison, instruction, or emotional framing. A
useful visual may be an existing product preview, diagram, annotated example, or a purpose-built
AI-generated illustration. Do not add stock-like or generated imagery merely to fill whitespace, hide
unedited prose, make a generic page appear designed, or compete with the primary task.

Every accepted media role declares its user purpose, owner and placement, source or generation brief,
responsive crop/contain behavior, and accessible alternative intent before implementation. Generate
a new bitmap only when no approved reusable asset serves the role and the generated result can be
reviewed as part of the same wide/intermediate/compact render matrix. Generated text, fake product UI,
brand drift, implausible detail, awkward cropping, or an image that consumes more attention than the
content it clarifies is a UI contradiction. Image generation produces an asset; it never creates
business authority or excuses weak content structure.

## Spacing and boundary

Every boundary has one padding owner. Parent-to-child spacing expresses relationship; internal spacing expresses one owner's rhythm. Do not stack parent and child padding into an accidental moat. Repeated rows share one rhythm and one divider owner. Prove edge alignment, first/last-child treatment and long-content wrapping.

Select spacing only after semantic grouping. A tightly coupled title and explanatory sentence form one copy group and may bind Core's compact `gap-2`; the following action belongs to a separate action boundary with stronger separation. Never apply one uniform stack gap across facts, explanation, controls, and disclosure merely because the numeric token is valid.

When adjacent siblings together explain one fact, create an explicit semantic group and bind its internal rhythm; do not leave them as peers in a looser outer stack. Current price plus its savings explanation is one evidence group, while purchase intent and action remain separate owners.

When an existing Grammar or application primitive owns the same scroll semantics, boundary, and constraints, reuse that primitive so edge cues, overscroll, focus, and scrollbar behavior remain coherent. Raw `overflow-*` is not an equivalent local replacement. Reuse is not blind copying: reject a precedent whose owner or interaction contract differs.

Disclosure labels and their indicators share one trigger-row owner, alignment axis, and inset. Comparison rows likewise keep their names and values on one predictable axis; a visually detached indicator or drifting value column is a composition failure.

## Hierarchy

Visual emphasis follows task consequence and information weight. Primary content receives the strongest position and enough width; supporting facts remain legible and subordinate. State markers supplement text and structure rather than replace them. Reading order and action order must remain intelligible without color.

Every datum declares its presentation rank. A compact numeric fact or status remains subordinate to its owning section and content title; concatenating it into a larger or equal-rank headline is a hierarchy failure.

Contract-declared progress remains an observable progress presentation; a badge-only substitute is not equivalent unless upstream authority changes the datum.

## Responsive persistence

Responsive rendering preserves meaning, reachability and necessary comparison. Tracks, order, disclosure and persistence may change, but ownership may not disappear. Sticky UI requires a declared scroll owner, bounded height, known offset, safe focus/overflow and a compact static fallback. Prove wide, intermediate and compact widths with both sparse and long content.

A pinned action projection and the content ending above it own one bottom boundary. Reserve that boundary exactly once: page stack gap, terminal content padding, and the pinned bar must not accumulate into a blank moat visible at scroll end.

A fixed or draggable overlay constrained to a safe viewport boundary does not reserve terminal document height. Do not add an empty document spacer for the same collision already prevented by the overlay constraint; that duplicates ownership and creates false scrollable space.

Disclosure does not erase information load; it only defers it. If opening secondary comparison data turns a primary decision card into a nested, internally scrolling information container, split the comparison into a peer surface or a dedicated sheet. Preserve one dominant decision per primary surface and do not repair overload by repeatedly reducing padding or typography.

After splitting an overloaded owner, reselect the interaction container from the remaining task instead of carrying the old container forward. A short comparison that must be seen together belongs in a static `SurfaceCard`; an accordion is justified only when hiding its content materially reduces task complexity. Separation alone is not proof that the inherited interaction still has value.

## State presentation and affordance

Render every reachable neutral presentation state required by the case. Controls expose a label, disabled reason, pending treatment, validation, recovery affordance, focus and keyboard path. Positive visual treatment is permitted only for an evidenced affirmative state and remains accompanied by understandable text; UI must never manufacture trust.

Category and magnitude labels are not outcome states, but neutrality is not the only valid category identity. Difficulty, tier, phase, and similar classifications use neutral treatment unless approved Grammar or application authority defines a stable categorical palette. That palette may reuse named tone tokens as visual identity without asserting pass, warning, or failure semantics when the text label remains explicit, the mapping is deterministic across every consumer, and it does not change with transient outcome state. Without that approved mapping, `success`, `warning`, and `danger` still require evidenced state or consequence semantics rather than an ordinal position or a desire for visual variety. Attach active emphasis to the value or status that is active, not to an adjacent identity label.

Glyph, shape, tone, and text form one semantic claim and must agree with the evidenced business state. Glyph geometry alone does not declare a state. The `complete` role and success-soft treatment require affirmative outcome evidence; X/incomplete and danger treatments require negative or incomplete evidence. A benefit, capability, promise, or future outcome is neutral content, not a completed or failed state. It may use a purpose-named 20px outline `included` circle-check in inherited foreground when adjacent text names what the offering contains; it must not reuse `complete`, success, accent tone, or solid weight. A negative glyph wearing a success tone is contradictory and fails UI review.

A destination-bearing row preserves native link semantics and a real non-null href so hover, focus, keyboard activation, and click expose the same route.
