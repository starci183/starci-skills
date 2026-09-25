# Layout tree

Product UI design follows the Next.js App Router layout architecture (owner-approved 2026-09-24). The frontend's
`app/` directory is the source of truth for what wraps a screen. The Work tree records it once, as the **layout
tree** at `.starciwork/shell/index.yaml` (schema `work/layout-tree@1`). Every drawing is composited into that
tree's real captures, and every build lands its files at that tree's paths.

It replaced the single hand-written app shell (`work/app-shell@1`, lane S 807195bed). That record described one
chrome in prose and checked the wording of drawing prompts. Parallel draw workers still redrew the chrome
themselves, and its navigation list could disagree with the routes that actually exist.

## The record

`node scripts/work/layout-tree.mjs scan --work .starciwork --write` generates the record. It only reads the
frontend repository, the one `workspace.yaml` binds with role `fe`, and writes nothing there.

| Part | What it holds |
| --- | --- |
| `app` | repository, app root, `appDir` (e.g. `apps/app/src/app`), `framework: next-app-router`, the locale param |
| `source` | scanner, frontend git revision, one digest over every scanned code file (routes, nav source); message catalogs are judged by `i18n.used` instead |
| `nodes[]` | one per `app/` segment, parents first: `id` (the path under app/, e.g. `/[locale]/(console)/agentos`), `segmentKind` (root, static, dynamic, catch-all, group, slot, intercept), `url` (groups and slots removed), `files` (layout, template, page, loading, error, not-found, default, route, each with sha256), `intercepts` (for `@slot/(.)x` pages, the full page they present) |
| `nodes[].layout` | for a `layout.tsx`: the chrome component it renders, `chrome` (visible, passthrough, unknown), `state`, its own `rev`, `nav` (registry items with labels per locale from the i18n catalogs, plus `findings`), `captures[]` per breakpoint and theme with the measured `slot`, or `design` (the ui record that draws a planned layout) |
| `productLocale`, `i18n` | the UI copy language, the message catalogs, and `i18n.used`: the message keys the tree uses (nav `i18nKey`, layout `titleKey`, a capture's `i18nKeys`) with one digest of their values per locale |
| `personas[]` | demo personas, one per role, exactly one default |
| `brand.lockups[]` | the rendered lockup |
| `breakpoints[]`, `themes[]` | the matrix every visible layout is captured at and every direction is composited at |

The scan reports navigation mismatches in `nav.findings`. It never patches them. The codes are
`NAV_ROUTE_MISSING` (a destination whose route no page answers), `NAV_ROUTE_NULL` (a destination drawn
disabled), `NAV_LABEL_MISSING` (a catalog lacks the label) and `ROUTE_NOT_IN_NAV` (a top-level route that no
destination reaches). A re-scan keeps what the owner decided: chrome, captures, personas, lockups and planned
nodes. A layout whose file or navigation changed gets its `rev` bumped and, if visible, goes back to `todo`.

## Ownership

`brand.decide` is the only writer of the layout tree. It already reads the frontend source, owns the logo and
the voice locales, and runs on the image-generation profile before any draw. Keeping one writer is what stops
parallel workers from inventing chrome. Its work:

1. Scan (or `convert` a `work/app-shell@1` record).
2. Decide each `chrome: unknown`.
3. Capture every visible layout at desktop and mobile in the light theme (dark is optional - kept where the
   tree already has it, never demanded). For each capture it renders a route under the
   layout with the whole chain above it, hides the slot's children, fills the slot element with `#FF00FF`, and
   records the capture with `layout-tree.mjs capture`, which measures the slot and bumps the layout rev when the
   capture changed.
4. Write the personas and the lockup.

On a greenfield product with no frontend yet, it plans the tree from the settled journeys and SDS with
`layout-tree.mjs plan --node <id> --files layout,page --design <ui-id>`. Each planned visible layout is drawn
first by its own `surface: layout` ui record in `interface.draw`, the layout leg. `interface.scaffold` creates
`app/` from the planned tree and re-scans it, which turns those nodes into origin repository. `brand.decide`
then takes the real captures.

## A ui record's place in the tree

| Field | Meaning |
| --- | --- |
| `route` | the node id, e.g. `/[locale]/(console)/agentos/[id]/accounting`. A route not in the tree yet names its nearest existing `routeParent`. |
| `surface` | `layout`, `page`, `modal`, `drawer`, `loading`, `error` or `not-found`. An overlay may differ per breakpoint, e.g. `{desktop: modal, mobile: drawer}`. |
| `direction` | drawer only: `left`, `right`, `top` or `bottom`, per breakpoint allowed. There is no sheet surface: a bottom sheet is a drawer from the bottom. |
| `routed` | modal or drawer only. `true` means an intercepting `@modal/(.)x` route plus the full page `x/page.tsx`. `false` means component state with no URL. |
| `host` | modal or drawer only: the ui record id, or the route, it opens over |
| `shell` | `{ref: shell, rev, layouts: [{node, rev}], activeNav}` for every visible layout above the route, or `{chromeless: true, because}` |

A popover, dropdown, toast or tooltip is not a surface. It is a state in the `ui.flow` of its page.

## Drawing: layouts first, chrome composited

- A page or overlay is drawn only when every layout above its route is settled. `api dispatch` enforces this
  (`interface.draw` reads.shell `layoutChain`, refused as `prerequisite-unmet` kind `layout-unsettled`), cut
  ordering enforces it (the layout job is enqueued first, and slices under it are enqueued `--after` it), and the
  draw proof enforces it (`LAYOUT_ANCESTOR_UNSETTLED`).
- ImageGen draws only the slot content (page, loading, error, not-found) at the slot's aspect ratio, or the
  panel (modal, drawer), or a layout's own chrome with its slot keyed `#FF00FF`.
- `node scripts/work/compose-direction.mjs --ui <dir> --content <png> --breakpoint <bp> --theme <t> --state <s>
  [--presentation page|overlay]` does the compositing in pure JavaScript over PNG pixels, so the output is
  identical on every host:
  - a page goes into the innermost visible layout's capture, at its slot;
  - an overlay goes over the host's page composite at the same breakpoint and theme, under a 0.5 black scrim,
    with a modal centred and a drawer anchored to its `direction` edge.

  It writes `assets/directions/<state>--<presentation>--<breakpoint>--<theme>.png` and prints the asset entries:
  the content (`direction-content`, with the ImageGen `generation`) and the composite (`direction`, with a
  `composite` block that records route, surface, presentation, breakpoint, theme, flow state, direction, the
  exact layout capture or host composite by path and sha256, the rectangle and the pixel digest).
- A routed overlay is composed in both presentations: over its dimmed host, and as its full page inside its
  layout chain. A non-routed overlay is composed only over its host.
- Every drawn state is drawn at desktop and mobile in the light theme (`DRAW_MATRIX_INCOMPLETE`); dark is
  optional.
- The owner reviews the part, never the composite (owner ruling 2026-09-24): a page's content, an overlay's
  panel alone, a layout's own drawing. The composite is evidence and the reference `interface.implement` builds
  and `interface.audit` compares against. `scripts/work/direction-part.mjs` is the selection `serve-ask` and
  `telegram-media` apply; it swaps a composite an older record still names for its `.content` part.

## Checks

`node scripts/checks/shell-conformance.mjs <work-root | shell-dir | ui-dir | impl-dir>` is structural. The only
prompt text it reads is the `Product locale: <default>` line.

- **Tree:**
  - the record is a layout tree (a `work/app-shell@1` record is refused as `SHELL_RECORD_LEGACY`);
  - nodes are consistent; lockups and personas are present;
  - the tree declares desktop, mobile and light (`SHELL_BREAKPOINT_MISSING`, `SHELL_THEME_MISSING`);
  - every visible layout is captured with its slot at desktop and mobile, light (dark optional);
  - a re-scan of `app/` still matches `source.digest` and the used message keys still read the same (`LAYOUT_TREE_STALE`). A catalog is shared by every workflow, so a key the tree does not use is never drift; a used key edited or removed is. A tree scanned before `i18n.used` keeps its whole-file digests valid until the next re-scan, judged by the keys it uses (`LAYOUT_TREE_I18N_UNKEYED`, info);
  - navigation mismatches are listed as suspects.
- **ui record:**
  - the route is in the tree or declared new;
  - surface, direction, routed and host are consistent per breakpoint;
  - every ancestor layout is settled and bound at its current rev;
  - every composite references the exact current capture for its breakpoint and theme, and re-derives to the
    same pixels (`COMPOSITE_NOT_REPRODUCIBLE`);
  - a routed overlay has both presentations; a non-routed overlay has no page presentation;
  - every drawn state has its composites at desktop and mobile, light (`DRAW_MATRIX_INCOMPLETE`).
- **implementation:** checked by re-scanning the real `app/`. Every routed ui record it builds has its
  `layout.tsx`, `page.tsx`, loading/error/not-found and, for a routed overlay, the `@slot/(.)segment`
  intercept.

`starci validate` runs the ui half without pixel re-derivation. It reports records drawn before the layout tree
(no binding, no route, a stale rev, a legacy shell) as suspects, never as refusals. `interface.audit` applies
the same check as its layout lens, classifying findings as `layout.structure` or `shell.conformance`.

## Migration

`work/app-shell@1` stays catalogued, so a record written earlier still validates. It is superseded, and
`node scripts/work/layout-tree.mjs convert --work .starciwork --write` rewrites it into a layout tree over a fresh
scan. The conversion carries over the product locale, persona (as role `primary`), lockup and breakpoint/theme
matrix, marks the legacy layout visible, and leaves the tree `todo`: the old captures have no measured slot, so
`brand.decide` re-captures them.
