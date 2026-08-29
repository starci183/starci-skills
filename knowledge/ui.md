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

## Spacing and boundary

Every boundary has one padding owner. Parent-to-child spacing expresses relationship; internal spacing expresses one owner's rhythm. Do not stack parent and child padding into an accidental moat. Repeated rows share one rhythm and one divider owner. Prove edge alignment, first/last-child treatment and long-content wrapping.

## Hierarchy

Visual emphasis follows task consequence and information weight. Primary content receives the strongest position and enough width; supporting facts remain legible and subordinate. State markers supplement text and structure rather than replace them. Reading order and action order must remain intelligible without color.

Every datum declares its presentation rank. A compact numeric fact or status remains subordinate to its owning section and content title; concatenating it into a larger or equal-rank headline is a hierarchy failure.

Contract-declared progress remains an observable progress presentation; a badge-only substitute is not equivalent unless upstream authority changes the datum.

## Responsive persistence

Responsive rendering preserves meaning, reachability and necessary comparison. Tracks, order, disclosure and persistence may change, but ownership may not disappear. Sticky UI requires a declared scroll owner, bounded height, known offset, safe focus/overflow and a compact static fallback. Prove wide, intermediate and compact widths with both sparse and long content.

## State presentation and affordance

Render every reachable neutral presentation state required by the case. Controls expose a label, disabled reason, pending treatment, validation, recovery affordance, focus and keyboard path. Positive visual treatment is permitted only for an evidenced affirmative state and remains accompanied by understandable text; UI must never manufacture trust.

A destination-bearing row preserves native link semantics and a real non-null href so hover, focus, keyboard activation, and click expose the same route.
