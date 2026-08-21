# Authored HTML design review

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@manifest-schema` | `publication/design-review-preview/schema.json` | file | validate the cache review graph |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish draft reviews and immutable accepted bundles |

## Record

This module displays layout and block choices without designing them. Draft reviews are rebuildable cache;
accepted composition is durable HTML bound to one immutable revision.

## Authority

JSON and HTML are co-authorities with disjoint responsibilities:

- `design.json` owns identity, parent binding, business/contract ownership, routed grammar facts/decisions/receipt, accepted artifact, post-creative
  `principleObligations`, UI-condition inventory, transition graph and the state viewport manifest.
- `preview.html` owns composition, hierarchy, surfaces, responsive behavior and the executable authored rendering
  of every declared state.

An accepted revision is exactly:

```text
registries/revisions/<revisionHash>/design.json
registries/revisions/<revisionHash>/preview.html
```

`design.json` carries `schemaVersion`, `kind`, `layoutId`, optional `blockId` and `layoutHash`, accepted artifact,
state viewport manifest and `previewSha256`. `revisionHash` binds canonical design metadata plus the preview
digest. The registry records revisions and points stable heads to them. Legacy objects are read-only
compatibility, not authority for new approval or execution.

Unaccepted candidates and their review manifest remain below `.worktrees/<project>/cache`. Losing candidates are
never copied into the registry.

## Review flow

### Layout

Display complete standalone authored HTML/CSS page sets with the same product-backed content and viewport set.
A screenshot review composes every visible nested layout, page and overlay. A flow review includes every explicit
page or step. Existing nodes are source/hash-bound and identical between choices. Display three or four
materially distinct choices, the model's ranking and its selected recommendation. The owner may override but
does not operate a mandatory candidate gate. After selection, deterministic
states of the selected layout are rendered without another approval; only a newly discovered product decision
opens a new round.

### Block

Display three or four materially distinct authored block choices inside the exact accepted parent
`preview.html`, exact region geometry and representative data, plus the model's ranking and selected
recommendation. The parent remains visible so composition is judged in context. The owner may override without
being required to choose. Deterministic selected-block states are then rendered without another approval; only
a new product decision opens a new round.

## Canvas law

The product canvas displays authored product HTML only. It never derives composition from JSON and never inserts
a generic template, rough child, dashed anatomy/part card, placeholder skeleton, schema/debug label, evidence or
hash. Review navigation, candidate names, evidence and approval help stay outside the product canvas.

Missing candidate HTML, exact-parent embedding, accepted state HTML or declared viewport is a blocking error. A
viewer warning or fabricated fallback cannot make the review approvable.

### Functional canvas law

Every candidate and accepted preview is one self-contained HTML document with deterministic in-memory behavior.
It exposes product controls for every declared transition and represents every evidenced UI condition: desktop
and mobile, modal, drawer, menu/popover, expanded/collapsed, loading, empty, partial, error, success, locked and
disabled. Irrelevant condition families are declared `not-applicable` with evidence. Actual viewport resize drives
responsive behavior; a separately painted narrow state is not sufficient. A QA state switcher lives outside the
canvas and never counts as interaction proof. `fetch`, XHR, WebSocket and backend mutation are forbidden in
preview code.

Every state is also business-faithful: it renders production-like representative density, real entity kinds,
meaningful values, counts, statuses, metadata, actions and consequences from the bound business surface. The
canvas must explain the product without relying on evidence text outside it. Lorem, placeholders, generic cards,
toy row counts, repeated filler and visibly partial owned surfaces are blocking defects.

## Quality proof

Review every candidate and accepted state at desktop and at least one narrow viewport. Prove:

1. Desktop and mobile navigation/chrome are mutually exclusive at their breakpoints.
2. Heading, primary action, data and supporting content have intentional hierarchy.
3. Reading and repeated content have intentional measure.
4. Each divider/boundary belongs to the region or grouping it separates; no divider is required without that
   boundary.
5. Each scrolling axis has exactly one owner; nested scrolling requires an evidenced independent viewport.
6. Every reachable state in the manifest has matching authored HTML at the declared viewport.
7. Every condition-inventory value maps to a rendered state and every transition is reachable from a visible,
   keyboard-operable in-page control.
8. Browser proof executes the critical transition graph at desktop and narrow widths, including every reachable
   modal, drawer, popover/menu and async/error branch, with a clean console and no network requests.
9. Each rendered state matches its business-content matrix closely enough that the entity, status, possible
   action and consequence are visually understandable at production-like density.

`ScrollBranch`, `SurfaceListCard` and dividers are examples of situation-specific resolutions, never universal
preview or product requirements.

The model creates and ranks three or four candidates before principles review. Only the selected candidate is
then audited against principles, and every resolution is persisted as a class-free obligation naming target,
principle module, canonical situation and reason. An accepted revision without those obligations is invalid.

## Rules

1. Draft candidates live only in project cache; accepted bundles live only under `registries/revisions`.
2. Layout and block phases each carry one model-selected recommendation; owner approval is required only when
   product truth or write authority remains unresolved.
3. A block review binds exact `layoutId`, parent `layoutHash` and declared `blockId`.
4. A block is always reviewed inside its exact parent layout and region bounds.
5. Accepted selected states are deterministic completion, not a second approval checkpoint.
6. Preview navigation never mutates registry state or counts as approval.
7. Every accepted `preview.html` digest and `revisionHash` are revalidated before execution.
8. Layout schema 4 binds `scope`, composed `pages`, ordered ownership nodes and page-owned regions.
9. Creativity precedes principles review; execution resolves the accepted obligations before source patterns.

## Stops

- Output outside project cache for drafts or outside the exact revision bundle for acceptance is refused.
- Missing authored candidate/state HTML, condition coverage, executable interaction or viewport coverage is refused.
- A render-only page, or a page whose states are reachable only through review chrome, is refused.
- A block bound to another parent hash or absent from parent regions is refused.
- A proposed or legacy-only object cannot be shown as current accepted authority.
- A post-choice state requiring a new route, owner, action or outcome returns to product approval.

## Output and proof

Publish one cache review application for drafts and one two-file bundle for the accepted revision. Run manifest
validation, preview digest/revision validation, Vite typecheck/build and browser QA over every declared viewport
and state with a clean console.
