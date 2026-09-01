# UI decision authority

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui` |
| Contract revision | `7.6.0` |
| Operators | `fe/request-compile` |
| Search tags | `ui, semantic card, composition, spacing, typography, TextLink, Button, IconTile, state, responsive, rank` |
| Dependencies | `fe.layout-composition, fe.grammar-common-overview`, plus exactly one selected Grammar and only its triggered object/case guides |

## Authority

Every render decision binds two authorities together:

1. `fe.ui` owns cross-object composition, hierarchy, responsive persistence, and decisive
   presentation laws;
2. Grammar Common plus exactly one selected Grammar owns object anatomy, visual language, supported
   states, variants, tokens, padding, gaps, typography, and responsive treatment.

Neither is optional. Never mix selected Grammars or invent a local convention for an axis already
owned by the selected package.

UI decides presentation, not customer journey order, business policy, API semantics, persistence,
authorization, or which product facts exist. It renders approved neutral facts and reachable states;
it never manufactures truth to improve a composition.

## Decision order

Each material decision records one verdict per layer:

1. `AI-first`: bind the approved meaning and decide what the user must notice first. Synthesis is
   justified only by real density or decision complexity; simple label/content stays direct.
2. `Rules-first`: prove semantic reading/action order, information rank, surface and collection
   ownership, nesting, responsive persistence, and complete state/recovery presentation.
3. `Grammar-last`: bind every accepted role to Grammar Common and one selected package's exact
   object, interface, state, token, and complex case.

Failure in any layer fails the decision. Grammar conformance cannot rescue incoherent meaning, and an
attractive layout cannot excuse an exact Grammar contradiction.

For every situation record the exact surface/region/state/viewport, presentation decision, Grammar
binding, observable implementation intent, negative boundary, and proof. Current source, a sibling
page, a Dashboard example, and a prior PASS are evidence—not authority by incumbency.

## Semantic card-first composition

Normalize content into semantic Blocks before choosing a frame. A coherent block-level responsibility
uses the selected Grammar's `SurfaceCard` by default when a visible boundary improves ownership and
scanning. A page field, article, joined collection, navigation owner, or intentionally frameless
region keeps its own declared object; “card-first” never means card-per-row or wrapping every element.

A single-function card and a compound multi-function card are different contracts. The single owner
uses one card body. A compound surface is valid only when its child blocks have distinct semantic
jobs but need one shared outer relationship; the outer surface owns frame/elevation, child blocks meet
through one divider owner, and no child competes with another card frame. Exact Core padding modes
belong only to `fe.grammar-core-object-surface-card`.

Every boundary has one padding owner. Page/content inset and peer-card rhythm belong to the selected
Grammar's page container; internal block rhythm belongs to the block. Never stack parent/child padding
into a moat or use one uniform gap across copy, facts, controls, disclosure, and peer cards. Core's
exact page inset and peer rhythm are authored once in `fe.grammar-core-pattern-page-container`.

A nested surface is justified only by a distinct repeated schema, focus, selection, scrolling, state,
or interaction owner. Removing the nested boundary must make responsibility ambiguous; otherwise it
is decoration. Repeated rows share one collection, rhythm, state position, and divider owner.

## Hierarchy and typography

Emphasis follows task consequence and information weight. Primary content receives the strongest
position and sufficient width; supporting facts remain legible and subordinate. A datum, status, or
delta cannot equal or exceed the visible rank of its owning section title. Reading and action order
remain intelligible without color.

Typography is role-bound, not a local size/weight choice. The selected package maps metadata,
supporting text, primary content, controls, and headings to its closed role matrix. Core's 12/14/base
scale and normal/medium/bold priority mapping live only in `fe.grammar-core-typography`. Do not use
weight or size to compensate for weak ownership, and do not promote every label to heading rank.

Ranked data binds numeric position, placement mark, score, and movement delta through
`fe.grammar-common-case-ranked-collection-semantics`. A medal, cup, arrow, sign, or tone supplements
explicit rank text; it never invents a placement or movement claim.

## Affordance and accent

Choose the semantic element from the effect. A destination uses native link semantics and a real
non-null href; a same-context command or mutation uses a button. A visually elevated destination may
use a package link-action treatment while remaining an anchor. Core's `TextLink`/`Button` boundary,
pending API, and restricted universal action-icon vocabulary live in
`fe.grammar-core-object-actions`.

An `IconTile` is a compact identity/accent owner, not a button decoration, state badge, or substitute
for a heading. Its accent-subtle surface and accent-text glyph identify one subject without claiming
selection, success, progress, or rank. The canonical color law lives in
`fe.grammar-common-semantic-color`.

Glyph, shape, tone, and adjacent text form one claim. Success/complete treatment requires affirmative
outcome evidence; negative treatment requires evidenced failure/destruction. A benefit, capability,
promise, category, difficulty, tier, or future outcome remains neutral unless approved authority
defines a stable non-outcome categorical mapping.

## State presentation

Render every reachable populated, initial-loading, pending mutation, settled empty, validation,
denied, error, recovery, refresh/resume, long-content, and responsive state required by compile.
Grammar state semantics are authored once in `fe.grammar-common-states-accessibility`:

- skeleton represents only unresolved initial content geometry;
- settled zero-data renders the owning `EmptyState`, never a lingering skeleton or blank shell;
- a mutation's pending state stays on its triggering button, prevents duplicate activation, and does
  not replace unrelated content with skeletons.

Controls expose label, pending/disabled meaning, validation, recovery, focus, and keyboard path.
Positive treatment is allowed only for evidenced affirmative state and remains understandable in text.

## Responsive persistence and interaction

Responsive rendering may change tracks, order, disclosure, and persistence, but not owner, meaning,
reachability, or necessary comparison. Wide, intermediate when materially distinct, and compact states
must pass sparse and long content.

Navigation and complementary rails transform rather than disappear. When compact composition removes
desktop orientation, provide the declared native mobile back link. Secondary rail/context work moves
behind an accessible three-dot trigger into the declared Drawer/Sheet with complete open, close,
focus-return, scroll, and restoration lifecycle. Exact Core navigation treatment lives in
`fe.grammar-core-object-navigation`.

Sticky or pinned UI names one scroll owner, height/offset/collision boundary, safe focus/overflow, and
compact static fallback. Reserve terminal clearance once; page gap, content padding, and pinned bar may
not accumulate into a blank moat.

A draggable fixed overlay owns no document spacer. It may cross underlying content while actively
dragged, but release, edge constraints, keyboard/focus access, resize/zoom, and restored position must
keep essential work recoverable. One captured overlap is evidence to exercise the lifecycle, not an
automatic exemption or automatic failure. Use
`fe.grammar-common-case-draggable-overlay-lifecycle`; no named launcher or Dashboard position is a
global law.

## Media

Treat media as information architecture, not decoration. After copy is reduced to its shortest useful
form, add media only when it materially improves orientation, recognition, explanation, comparison,
instruction, identity, evidence, or emotional framing. Every accepted media role declares purpose,
owner, placement, source/brief, responsive crop/contain behavior, and accessible alternative intent.

Do not add stock-like or generated imagery to fill whitespace, hide unedited prose, mimic a sibling,
or make a generic page appear designed. Generated text, fake product UI, brand drift, implausible
detail, awkward crop, or media that dominates the task is a contradiction.

## Evidence and promotion boundary

Owner feedback and Dashboard surfaces may reveal reusable relationships such as compound-card
padding, ranking semantics, mobile rail access, or drag restoration. Promote only the smallest law
proved across its semantic owner and preserve a negative boundary. Never encode a page name, fixture,
copy string, route, or screenshot arrangement as the global rule.

## Grammar gap versus visual ambiguity

Use `fe.grammar-common-extension` as the single authority. Missing semantic rule, token,
component/export, state, or extension axis is `grammar-gap`: the exact Grammar owner repairs and
publishes it, then frontend recompiles against the new package identity. It is never a local
compatibility path or permission for page-local CSS/anatomy improvisation. When Grammar is complete,
render one preview
for a materially dominant direction; if several real directions remain and none dominates, render
three or four inside the single `fe/direction-generate` product and wait for the exact selected id.

## Verdict

- `PASS`: all three decision layers pass at every required state and viewport.
- `FAIL`: visible/runtime evidence contradicts meaning priority, UI composition, or Grammar.
- `BLOCKED`: required authority, runtime evidence, or a valid choice product is unavailable.

A finite visual choice is not a verdict. It yields the typed direction-choice wait owned by the
frontend machine; approve resumes the exact selected direction and reject terminates without apply.
