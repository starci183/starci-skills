# UI decision authority

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui` |
| Operators | `principle-compile` |
| Search tags | `ui, principles, grammar, composition, spacing, hierarchy, responsive, render decision, suspense` |
| Dependencies | `fe.layout-composition, fe.grammar-common-overview`, plus exactly one selected Grammar and only its triggered object/case guides |

## Authority

UI is decided by two authorities together:

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

- `PASS`: the rendered result matches both `fe.ui` and the selected Grammar at every required state and viewport.
- `FAIL`: runtime evidence contradicts an applicable UI or Grammar rule. Fix the owning FE/BE source, then retest the same case.
- `SUSPENSE`: no applicable rule exists, required authorities conflict, or the authority does not specify enough to decide how the state should render.

`SUSPENSE` is not a stylistic guess, not runtime `BLOCKED`, and never counts as PASS. Record the exact unresolved render question, request owner feedback, update the smallest UI/Grammar authority, then rerun the case. The calibration goal is `NO SUSPENSE`.

## Composition

Give every meaningful region one clear owner. A child collection receives a distinct nested surface only when it owns a repeated schema, row boundaries, state or interaction boundary; decoration alone never justifies nesting. Removing the child surface must make grouping or ownership ambiguous, otherwise the nested surface is unnecessary.

Separate dense subjects when they have different decisions, states or scan patterns. Preserve one obvious reading order and one obvious primary-action order. Supporting information stays visible without competing with the primary task.

## Spacing and boundary

Every boundary has one padding owner. Parent-to-child spacing expresses relationship; internal spacing expresses one owner's rhythm. Do not stack parent and child padding into an accidental moat. Repeated rows share one rhythm and one divider owner. Prove edge alignment, first/last-child treatment and long-content wrapping.

## Hierarchy

Visual emphasis follows task consequence and information weight. Primary content receives the strongest position and enough width; supporting facts remain legible and subordinate. State markers supplement text and structure rather than replace them. Reading order and action order must remain intelligible without color.

## Responsive persistence

Responsive rendering preserves meaning, reachability and necessary comparison. Tracks, order, disclosure and persistence may change, but ownership may not disappear. Sticky UI requires a declared scroll owner, bounded height, known offset, safe focus/overflow and a compact static fallback. Prove wide, intermediate and compact widths with both sparse and long content.

## State presentation and affordance

Render every reachable neutral presentation state required by the case. Controls expose a label, disabled reason, pending treatment, validation, recovery affordance, focus and keyboard path. Positive visual treatment is permitted only for an evidenced affirmative state and remains accompanied by understandable text; UI must never manufacture trust.
