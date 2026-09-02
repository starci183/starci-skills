# Common spacing supplementation plan

Status: planning evidence only. This file is not runtime UI knowledge and does not claim that any
listed capability is implemented.

## Objective

Complete public semantic consumption of Common spacing without changing the existing scale
`0 / .25 / .5 / .75 / 1 / 1.5 / 2rem`. The values equal `0 / 4 / 8 / 12 / 16 / 24 / 32 CSS px`
only at a computed `16px` root. Runtime proof uses
`expectedPx = remFactor * observedRootFontPx` within epsilon. Make one owner observable from Common through a family to a
real route, then migrate applications only after the needed capability exists. Audits emit one
canonical base verdict per failed layer plus cause tags; `COMMON_CAPABILITY_MISSING` and an
`APP_WORKAROUND` are
linked findings, not one composite verdict.

## Bound source findings

### Spacing

- `COMMON_SPACING_SCALE` exists, but public semantic consumption is incomplete.
- `SurfaceCopyGroup` exposes only `compact=.5rem` and `comfortable=.75rem` (8/12 CSS px at a 16px
  root); compact identity `.25rem` has no clear public consumable path.
- The `2rem` scale value (32 CSS px at a 16px root) has no public major-transition binding.
- Private `--starci-core-*` aliases compete with public `--grammar-*` variables and obscure the
  Common→family ownership chain.
- Current application evidence contains Tailwind `gap-1` = `.25rem` (4 CSS px at a 16px root) and
  `gap-0.5` = `.125rem` (2 CSS px at a 16px root) identity recipes. These are evidence for capability
  analysis, not fixed-pixel authority or permission to add a tier/copy implementation.

### Padding

- HeroUI `Card.Root` plus an application/global `.card` rule can leak an outer `1rem` inset (16 CSS px
  at a 16px root) into the
  Grammar root. Common needs one explicit neutralization boundary and computed-route proof.
- Joined faces need an explicit Common capability so child bands can own seams without inheriting an
  ordinary content inset.
- Input trailing reserve must be logical-direction aware and owned by the Input anatomy, not patched
  by a route.
- `PageContainer` geometry can currently escape through broad `className`/`style` overrides; public
  placement flexibility and protected internal inset need a precise boundary.

### Margin

- `MarkdownArticle` renderer hooks and its CSS bindings are disconnected, so intended rhythm may not
  reach rendered output.
- Parent `gap` plus child margins can double vertical rhythm and create two owners.
- `PageContainer className/style` can override geometry rather than only place the whole object.
- `WorkspaceShell` contains an unnamed `1.5rem` margin (24 CSS px at a 16px root); it needs a semantic
  owner or removal.

## Priority plan

### P0 — Establish public ownership and computed proof

1. Extend the existing public `COMMON_SPACING_TOKENS` and CSS-hook registry with a named
   compact-identity `.25rem` path; do not recreate the registry or expose arbitrary raw spacing.
2. Complete and prove consumable Common anatomy bindings for compact identity (`.25rem`), the existing
   inline/control (`.5rem`), peer row/field (`.75rem`), block/section (`1rem`), and region (`1.5rem`)
   hooks. Each binding has
   exactly one parent owner, zero child margins, and zero missing-child residue.
3. Add isolated computed tests across `Common → each family → representative route`; assert the exact
   computed value rather than only source tokens or class strings.
4. Neutralize the Card root's vendor inset inside Common and prove that route/global CSS cannot
   reintroduce the `1rem` outer padding through `.card` or `data-slot` reach-through.
5. Repair and test logical Input trailing reserve in both inline directions under one Input-anatomy
   owner; positioning offsets are not padding and must remain outside this contract.
6. Reconnect `MarkdownArticle` renderer hooks to their CSS bindings and remove doubled parent-gap plus
   child-margin rhythm.
7. Add layered one-owner enforcement that detects duplicate owners and app/family deltas, emitting
   canonical base verdicts with cause tags rather than first-match or composite verdicts.

Dependencies: freeze the compact-identity name and ownership before extending the existing registry;
consumable Common anatomy bindings before family bindings; family bindings before route assertions.

Acceptance evidence:

- the extended existing registry and consumable anatomy bindings author exactly
  `.25/.5/.75/1/1.5rem`;
- computed proof covers at least root `16px` and `20px`: those factors resolve to 4/8/12/16/24 and
  5/10/15/20/30 CSS px respectively, within epsilon;
- computed tests pass for Common, every published family, and at least one real route per family;
- optional-child removal leaves zero spacing residue;
- family paint changes do not change computed spacing;
- app CSS cannot reach through Grammar anatomy to change the metric;
- Input reserve is correct in both logical directions;
- MarkdownArticle bindings affect computed output and no gap+margin double owner remains.

### Audit binding architecture

1. Common reusable components expose stable `data-component`, `data-slot`, and relationship anchors.
   These anchors identify rendered anatomy; they do not carry verdicts or duplicate rule formulas.
2. A generated or co-located audit registry maps each component to an exact target slot or
   between-slot relationship, its selection `when` (variant, state, or composition), the expected
   owner anchor, one stable binding/version ID, and one GAP/PADDING/MARGIN `ruleId`. A flat array of
   component-level rule IDs is insufficient because it cannot identify what is measured or when.
3. Knowledge remains the only owner of the metric or formula. Do not hand-author `x` or
   `data-v8-rules` arrays in app JSX or put them in the production DOM.
4. The auditor resolves registry bindings from the rendered anchors, runs the metric checks, and
   records the applied rule IDs in the audit result. An app cannot label itself `PASS`.
5. Build validation rejects missing target slots, unknown or orphan rule IDs, stale anchors, and
   binding/version IDs that no longer match the rendered anatomy.

Initial bindings use only owners supported by current source: `PageContainer` → `PADDING-1` and
`MARGIN-2`; `SurfaceCard` → `PADDING-2`; and `MarkdownArticle` → `MARGIN-3` after its hook is repaired.
A compact-identity binding is added only after that Common capability exists.

Acceptance evidence:

- every binding names `ruleId`, exact target or relationship, `when`, expected owner anchor, and a
  stable binding/version ID without copying the rule's metric;
- registry and rendered anchors agree, while missing slots, unknown/orphan IDs, and stale anchors
  fail validation;
- audit output records resolved rule IDs and measured evidence independently of application markup.

### P1 — Complete missing roles and freeze geometry boundaries

1. Add a named public major-transition binding for `2rem` with a distinct selection condition from the
   ordinary `1.5rem` region relationship (32 versus 24 CSS px only at a 16px root).
2. Replace private `--starci-core-*` metric aliases with public semantic `--grammar-*` hooks where the
   metric is universal; retain family-private variables only for paint.
3. Freeze and name Common control-padding baselines, then bind them without mixing positioning offsets
   into padding.
4. Freeze and publish the selection contract for the existing `formPageClassName` plus CSS formula.
   Select the branch with actual CSS media-query semantics, proven by
   `matchMedia('(min-width: 40rem)').matches`; changing the styled root font size does not move this
   breakpoint. After the branch is selected, resolve property values from the observed computed root:
   `1.5rem` block / `1rem` inline below the breakpoint, and `2.5rem` block / `1rem` inline at or above it.
   Add isolated computed proof; do not recreate the formula.
5. Define and test joined-face padding and a PageContainer extension contract that allows whole-object
   placement/width without internal inset override.
6. Constrain PageContainer geometry escapes and name or remove the WorkspaceShell `1.5rem` margin.

Dependencies: P0 registry extension, consumable bindings, and computed harness; exact anatomy owner
identified for every padding and margin finding.

Acceptance evidence:

- major transition authors `2rem` and computes by the observed root only under its named condition;
- no universal metric depends on a private family alias;
- Common control-padding baselines are frozen, named, and independently computed;
- FormPage proof records `matchMedia('(min-width: 40rem)').matches` separately from root font size.
  The media-query result selects the `1.5rem/1rem` or `2.5rem/1rem` branch; root `16px` resolves those
  properties to 24/16 or 40/16 CSS px, and root `20px` resolves them to 30/20 or 50/20 CSS px within
  epsilon. Root font size changes property values, not breakpoint selection;
- positioning offsets are not classified or implemented as padding;
- joined faces have one inset/seam owner;
- PageContainer public extensions cannot mutate protected inset;
- PageContainer and WorkspaceShell each have one measurable rhythm owner.

### P2 — Migrate consumers and automate regression detection

1. Inventory StarCi, Nivo, and Tayson spacing usage and classify each occurrence as product placement,
   public Common consumption, reach-through override, `APP_WORKAROUND` for missing capability, or
   reimplementation of an existing capability.
2. Migrate only after the matching Common capability and family binding are green. Preserve legitimate
   page-canvas, product-layout/content/media, and public placement CSS.
3. Remove application reimplementations and reach-through rules, then add static boundary checks for
   protected Grammar slots/private metric aliases without banning ordinary application stylesheets.
4. Run state, viewport, optional-child, zoom, and translated-content computed probes to prevent drift.

Dependencies: P0 and relevant P1 capability complete; route owner approves each consumer migration.

Acceptance evidence:

- no consumer migration precedes capability availability;
- no app selector reaches into protected Grammar anatomy or rewrites semantic spacing;
- application-owned placement remains functional;
- computed metrics remain stable across family, state, and viewport matrices.

## Migration sequence

1. Record baseline computed metrics and selector ownership.
2. Publish the smallest Common semantic capability.
3. Bind every family without changing the metric.
4. Prove Common→family→route computed output.
5. Migrate one application owner at a time and delete only the replaced rule.
6. Re-run route, state, viewport, optional-child, and accessibility evidence before continuing.

## Non-goals

- No new arbitrary scale values or utility escape hatch.
- No blanket ban on application CSS.
- No visual redesign, business behavior, route, data, copy, or interaction change.
- No application migration before a public Common capability exists.
- No family-specific universal metric; families retain paint character only.
- No claim in invariant knowledge that planned work is already implemented.
