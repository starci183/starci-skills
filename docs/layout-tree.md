# Layout tree

Product UI design follows the Next.js App Router layout architecture (owner-approved 2026-09-24). The frontend's
`app/` directory is the source of truth for what wraps a screen. The Work tree records it once, as the **layout
tree** at `.starciwork/shell/index.yaml` (schema `work/layout-tree@1`). Every drawing is composited into that
tree's real captures, and every build lands its files at that tree's paths.

It replaced a single hand-written app shell that described one chrome in prose and checked the wording of
drawing prompts. Parallel draw workers still redrew the chrome themselves, and its navigation list could
disagree with the routes that actually exist.

## The record

`starci work layout-tree scan --work .starciwork --write` generates the record. It only reads the
app's front end (`fe/`) beside the Work tree's app root, and writes nothing there.

### Apps

The front end may hold several apps (for example `fe/apps/app`, the console, and `fe/apps/landing`, the public
website). The record holds one tree per app under `apps[]`, and a node id is a route within its app, so `/` exists
once per app. The app root's `hfs.json` `sides.fe.apps` declares which apps there are, each at `fe/apps/<name>`
(`scripts/work/layout-tree.mjs` `frontendOf`); nothing else names them, and every path the record holds is
app-relative. `workspace.yaml` names only the two sides as its repositories:

```yaml
repositories:
  - role: be
    name: be
  - role: fe
    name: fe
```

The App Router directory of an app is `<root>/src/app` or `<root>/app`. A Work tree whose app declares no front-end
app is refused by the scan (`--app-dir` names directories for a scan outside the declaration). The scan reads every
declared app and drops an app the declaration no longer names. `capture`, `plan` and `destinations --route`
take `--app <name>` when the tree holds more than one; capture names carry the app (`assets/layouts/<app>--...`).

| Part | What it holds |
| --- | --- |
| `apps[]` | one per app: `name`, repository, app root, `appDir` (e.g. `fe/apps/app/src/app`), `framework: next-app-router`, the locale param, and that app's own `source`, `i18n` and `nodes[]` below |
| `apps[].source` | scanner, frontend git revision, one digest over every scanned code file (routes, nav source); message catalogs are judged by `i18n.used` instead |
| `apps[].nodes[]` | one per `app/` segment, parents first: `id` (the path under app/, e.g. `/[locale]/(console)/agentos`), `segmentKind` (root, static, dynamic, catch-all, group, slot, intercept), `url` (groups and slots removed), `files` (layout, template, page, loading, error, not-found, default, route, each with sha256), `intercepts` (for `@slot/(.)x` pages, the full page they present) |
| `nodes[].layout` | for a `layout.tsx`: the chrome component it renders, `chrome` (visible, passthrough, unknown), `state`, its own `rev`, `nav` (registry items with labels per locale from the i18n catalogs, plus `findings`), `captures[]` per breakpoint and theme with the measured `slot`, or `design` (the ui record that draws a planned layout) |
| `productLocale`, `apps[].i18n` | the UI copy language, each app's message catalogs, and `i18n.used`: the message keys the tree uses (nav `i18nKey`, layout `titleKey`, a capture's `i18nKeys`) with one digest of their values per locale |
| `personas[]` | demo personas, one per role, exactly one default |
| `brand.lockups[]` | the rendered lockup |
| `breakpoints[]`, `themes[]` | the matrix every visible layout is captured at and every direction is composited at |

The scan reports navigation mismatches in `nav.findings`. It never patches them. The codes are
`NAV_ROUTE_MISSING` (a destination whose route no page answers), `NAV_ROUTE_NULL` (a destination drawn
disabled), `NAV_LABEL_MISSING` (a catalog lacks the label) and `ROUTE_NOT_IN_NAV` (a top-level route that no
destination reaches). A re-scan keeps what the owner decided: chrome, captures, personas, lockups and planned
nodes. A layout whose file or navigation changed gets its `rev` bumped and, if visible, goes back to `todo`.

## Ownership

The layout tree is a foundation shared by the workflows of a project, written by one workflow at a time:
`interface.draw` when it starts from a todo or unsettled shell (owner ruling 2026-09-29: a draw must work from todo;
`starci kernel dispatch` claims foundation `shell` for the first draw that finds parents to draw, a draw of another workflow
waits as `foundation-wait`, and a stalled owner opens a Supervisor Decision Item), and `brand.decide`, which still
sets the brand identity and direction and may capture layouts. Keeping one writer at a time is what stops parallel
workers from inventing chrome. The work, whichever op does it:

1. Scan.
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
`app/` from the planned tree and re-scans it, which turns those nodes into origin repository. The next
`interface.draw` (or `brand.decide`) then takes the real captures.

## A ui record's place in the tree

| Field | Meaning |
| --- | --- |
| `app` | the frontend app the route is in, a name in the tree's `apps[]`. Optional when the tree holds one app, or when only one app holds the route (or its `routeParent`); otherwise required. `UI_APP_UNKNOWN` (not an app of the tree) and `UI_APP_MISSING` (the route does not decide) refuse; a route the named app does not hold is `UI_ROUTE_UNKNOWN`. |
| `route` | the node id in its app, e.g. `/[locale]/(console)/agentos/[id]/accounting`. A route not in the tree yet names its nearest existing `routeParent`. |
| `surface` | `layout`, `page`, `modal`, `drawer`, `loading`, `error` or `not-found`. An overlay may differ per breakpoint, e.g. `{desktop: modal, mobile: drawer}`. |
| `direction` | drawer only: `left`, `right`, `top` or `bottom`, per breakpoint allowed. There is no sheet surface: a bottom sheet is a drawer from the bottom. |
| `routed` | modal or drawer only. `true` means an intercepting `@modal/(.)x` route plus the full page `x/page.tsx`. `false` means component state with no URL. |
| `host` | modal or drawer only: the ui record id, or the route, it opens over |
| `shell` | `{ref: shell, rev, layouts: [{node, rev}], activeNav}` for every visible layout above the route, or `{chromeless: true, because}` |

A popover, dropdown, toast or tooltip is not a surface. It is a state in the `ui.flow` of its page.

## Drawing: layouts first, chrome composited

- `interface.draw` starts from todo: a missing shell or an unsettled layout above its route is never a dispatch
  refusal. The op scans the tree, draws or captures the missing shell, ancestor layouts and lockup FIRST, settles
  them, then draws its screens on top. The draw proof judges the result (`LAYOUT_ANCESTOR_UNSETTLED` when a layout is
  still unsettled after the op), cut ordering keeps the layout job first (slices under it are enqueued `--after` it),
  and the shell foundation (`scripts/kernel/shell-foundation.mjs`) keeps two workflows from drafting it in parallel.
  Code is the other way round: `interface.implement` is refused (`DESIGN_NOT_SETTLED`) until the ui record it proves
  has a settled draw.
- ImageGen draws only the slot content (page, loading, error, not-found) at the slot's aspect ratio, or the
  panel (modal, drawer), or a layout's own chrome with its slot keyed `#FF00FF`.
- `starci work compose-direction --ui <dir> --content <png> --breakpoint <bp> --theme <t> --state <s>
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

`starci work shell-conformance <work-root | shell-dir | ui-dir | impl-dir>` is structural. The only
prompt text it reads is the `Product locale: <default>` line.

- **Tree:**
  - the record is a layout tree (any other schema is refused as `SHELL_RECORD_NOT_TREE`);
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

`starci runtime validate` runs the ui half without pixel re-derivation. It reports records drawn before the layout tree
(no binding, no route, a stale rev) as suspects, never as refusals. `interface.audit` applies
the same check as its layout lens, classifying findings as `layout.structure` or `shell.conformance`.
