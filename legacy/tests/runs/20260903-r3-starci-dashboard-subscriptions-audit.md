# R3 — Screenshot UX/UI audit: dashboard and subscriptions

- Date: 2026-09-03
- Role: `frontend.surface.audit` (read-only on source; no file in the target repo was edited, no git write was run)
- Worktree: `D:\Repositories\starci-academy-backend\.worktrees\sessions\20260903-starci-dashboard-subscriptions\checkout`
- Repo / branch / head: `starci-academy-fe` / `session/20260903-starci-dashboard-subscriptions` / `a01f0e8`
- Runtime: Next.js 16.3.1 dev on port 3000 (started for this run, stopped at the end); backend API on 3001; Postgres on 5432; **Keycloak 8089 down — no sign-in was attempted and no credential was typed**
- Capture engine: headless Chrome driven through `puppeteer-core` (the Browser pane screenshot tool cannot write files), full page, `prefers-color-scheme` emulated per capture
- Evidence: `.claude/tests/evidence/20260903-starci-dashboard-subscriptions/`

## What could and could not be seen

`/vi/subscriptions` renders fully for a signed-out reader and carries the whole `ProSubscriptionBlock` plus `ShellNav`, so it carried the audit. Both `/vi` and `/vi/dashboard` redirect to `/vi/authentication?authState=sign-in`; that was reproduced in fresh incognito contexts at both widths and both schemes, so it is the surface's real signed-out behaviour and not cookie bleed from an earlier capture. Because Keycloak is down there is no way past that redirect. The eight `home-*` and `dashboard-*` PNGs therefore show the sign-in form, not the requested surface, and both are recorded below as `RUNTIME_UNAVAILABLE`. The `ShellNav` search trigger the brief wanted checked on `/vi` was audited on `/vi/subscriptions` instead, which mounts the same shell.

One further state is unreachable for the same reason: the plan status band (`proStatusClassName`, `rounded-xl`) renders only for `verification-pending`, `active` and `cancelled`, all of which need a signed-in read. Its corner radius is recorded as unobserved rather than guessed.

## Verdict table

| surface | width | scheme | finding | severity | rule | screenshot |
| --- | --- | --- | --- | --- | --- | --- |
| subscriptions | 1280 | light | Sticky band and separator present and correct; `header.starci-core-navigation-feature-nav` is `position: sticky; top: 0`, 79px tall, with its bottom separator | pass | LAYOUT-4 Case 1 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | light | Search trigger reads as a field: 1px border, 12px radius, leading magnifier, muted placeholder, `Ctrl K` kbd chip | pass | HIERARCHY-1 Case 2 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | light | `PressableField` takes its width from the parent (`width: 100%; min-width: 0`, shrinks as a flex item to 179px in a fully packed 280px tools row) — no fixed pixel width | pass | RESPONSIVE-1 Case 1 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | light | Purchase button is full width of its track (304px in a 304px grid column), 44px tall, radius 24px, label on one line | pass | CTA-1 Case 1 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | light | Plan details gap is a uniform 16px between plan name, price and renewal note; the action band is separated by a full-bleed `border-t` and 12px inset | pass | GAP | `subscriptions-1280-light.png` |
| subscriptions | 1280 | light | No overflow: `scrollWidth == clientWidth == 1280`, zero elements crossing the inline edge | pass | OVERFLOW | `subscriptions-1280-light.png` |
| subscriptions | 1280 | light | **DEF-3** Two peer sections in the same column disagree by 16px. Both outer boxes are `x=32 w=808`, but the benefits `SurfaceCard` carries `padding: 16px`, so its visible band and its label sit at `x=48`, while the `SurfaceAccordionCard` below has `padding: 0` and sits at `x=32` | major | MARGIN / HIERARCHY-2 Case 4 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | light | **DEF-4** Heading outline skips a level and ends out of order: `H1 → H3 → H3 → H3 → H3 → H2`. The only `H2` is the rail plan name, last in DOM; the four card labels are `H3` with no `H2` above them | major | HIERARCHY-1 Case 1 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | light | **DEF-5** Every control in the nav row is 36px tall — search field, three tabs, language menu (22×36), cart and account (36×36) | major | touch-target floor 44px | `subscriptions-1280-light.png` |
| subscriptions | 1280 | light | **DEF-6** Viewport breakpoints govern regions whose owner is a container query: `sm:grid-cols-2` on the benefits grid and `sm:px-6 / sm:pt-6 / sm:pb-6` on the plan card | minor | RESPONSIVE-2 Case 5 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | light | Status band corner radius not observable — the band renders only in signed-in lifecycle states | RUNTIME_UNAVAILABLE | RADIUS-5 | — |
| subscriptions | 1280 | dark | Dark tokens swap cleanly: body, surface, separator, foreground, muted and accent all resolve to their dark values; no unthemed white surface | pass | TONE | `subscriptions-1280-dark.png` |
| subscriptions | 1280 | dark | DEF-3, DEF-4, DEF-5, DEF-6 all reproduce identically; the 16px misalignment is more visible against the dark ground | major | as above | `subscriptions-1280-dark.png` |
| subscriptions | 1280 | dark | **DEF-7** The journey illustration is a single light-ground PNG, so it renders as a large white block against the dark surface | minor | TONE | `subscriptions-1280-dark.png` |
| subscriptions | 390 | light | **DEF-1** The rail layout never collapses. `starci-core-primary-rail-layout` computes `grid-template-columns: 0px 334px` in a 358px container: the primary track is **0px wide**, the benefits card and the 2×2 grid are invisible, section labels wrap one word per line inside a 32px column, the rail card overlaps them, and roughly 1500px of the 2071px page is void | **blocker** | RESPONSIVE-1 Cases 1–2, RESPONSIVE-3 Case 3, LAYOUT-3 Case 1 | `subscriptions-390-light.png` |
| subscriptions | 390 | light | **DEF-2** Collapsed rail order is undecided — the block passes no `collapsedOrder`, so once DEF-1 is fixed the purchase decision lands after the whole explanatory column. On a single-decision purchase surface the rail should lead | major | RESPONSIVE-1 Case 1 | `subscriptions-390-light.png` |
| subscriptions | 390 | light | **DEF-5** Compact icon buttons (overflow, cart, account) are 40×40 | major | touch-target floor 44px | `subscriptions-390-light.png` |
| subscriptions | 390 | light | Purchase button still full width (270px of 270px), 44px tall, label on one line; no inline overflow (`scrollWidth == clientWidth == 390`) | pass | CTA-1, OVERFLOW | `subscriptions-390-light.png` |
| subscriptions | 390 | dark | DEF-1, DEF-2, DEF-5 reproduce identically; the cause is scheme-independent | **blocker** | as above | `subscriptions-390-dark.png` |
| dashboard | 1280 | light | Redirects to `/vi/authentication?authState=sign-in`; Keycloak down, sign-in not attempted | RUNTIME_UNAVAILABLE | — | `dashboard-1280-light.png` (sign-in form) |
| dashboard | 1280 | dark | Same redirect | RUNTIME_UNAVAILABLE | — | `dashboard-1280-dark.png` (sign-in form) |
| dashboard | 390 | light | Same redirect | RUNTIME_UNAVAILABLE | — | `dashboard-390-light.png` (sign-in form) |
| dashboard | 390 | dark | Same redirect | RUNTIME_UNAVAILABLE | — | `dashboard-390-dark.png` (sign-in form) |
| home | 1280 | light | Redirects to `/vi/authentication?authState=sign-in`; `ShellNav` never mounts, so the search trigger was audited on `/vi/subscriptions` | RUNTIME_UNAVAILABLE | — | `home-1280-light.png` (sign-in form) |
| home | 1280 | dark | Same redirect | RUNTIME_UNAVAILABLE | — | `home-1280-dark.png` (sign-in form) |
| home | 390 | light | Same redirect | RUNTIME_UNAVAILABLE | — | `home-390-light.png` (sign-in form) |
| home | 390 | dark | Same redirect | RUNTIME_UNAVAILABLE | — | `home-390-dark.png` (sign-in form) |

## Overall verdict — FIX FIRST

The wide branch of `/vi/subscriptions` is close to shippable: the hierarchy reads correctly, the sticky band and its separator hold, the search trigger is unmistakably a field, the purchase button is full width with a 44px target and a label that does not wrap, and dark mode swaps every token it should. The compact branch is not shippable at all. At 390px the primary column is zero pixels wide, so the entire product explanation — the illustration, the four included outcomes, both disclosures — is invisible to a reader on a phone, and what remains is a rail card floating over four stacked letters of a heading. That single defect blocks the surface on its most likely device.

## Defect list

### DEF-1 — blocker — `PrimaryRailLayout` never collapses

`packages/grammar/src/common/styles.css:186-187` versus `packages/grammar/src/common/styles.css:1169-1173`.

The collapse rule is written as a bare class inside a container query:

```
@container starci-core-primary-rail (max-width: 56rem) {
    .starci-core-primary-rail-layout { grid-template-columns: minmax(0, 1fr); }
}
```

but the rail width is written as an attribute selector outside it:

```
.starci-core-primary-rail-layout[data-grammar-layout-rail-width="wide"] { grid-template-columns: minmax(0, 1fr) minmax(20rem, 24rem); }
```

A container query adds no specificity, so `(0,2,0)` beats `(0,1,0)` and the two-column form survives at every container width. `ProSubscriptionBlock` asks for `railWidth="wide"` at `src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:204`, which is exactly the value that triggers it; the observed `0px 334px` is `358 − 24 gap − 334 rail`. Any consumer passing `railWidth="compact"` is broken the same way, so this is a Grammar defect, not an application one. The repair belongs in Grammar: either restate the collapse for each `[data-grammar-layout-rail-width]` value inside the container query, or move the rail track into a custom property that the base rule reads and the container query sets to `0`.

### DEF-2 — major — collapsed rail order is not decided

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:203-262` passes only `railWidth`, never `collapsedOrder`. Grammar supports `data-grammar-layout-collapsed-order="rail-first"` (`packages/grammar/src/common/styles.css:1175-1177`), and on a surface whose one job is a purchase the price and the button are the decision the reader came for. Once DEF-1 is fixed the default primary-first order would bury the CTA below the illustration, the four outcomes and both disclosures.

### DEF-3 — major — 16px misalignment between peer sections

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:207` (`SurfaceCard`, `padding: 16px`, `card--transparent`) against `:237` (`SurfaceAccordionCard`, `padding: 0`). Both sit in the same `proMainClassName` column (`classNames.ts:15`) and both outer boxes measure `x=32 w=808`, but only one inset its visible surface and its label. Either give the accordion the same inset or drop it from the benefits card.

### DEF-4 — major — heading outline skips a level

`component.tsx:196-201` emits the page `H1`; the `SurfaceCard`/`SurfaceAccordionCard` `label` props at `:207` and `:239` and the two disclosure summaries emit `H3`; the rail's `Heading level={2}` at `:162` is the only `H2` and it is last in DOM. The reader's outline and the screen reader's outline both jump `H1 → H3`.

### DEF-5 — major — touch targets below 44px

`packages/grammar/src/common/styles.css:263-267` sets `height: 2.25rem` on `PressableField`; the nav tabs, language menu, cart and account controls match it at 36px on desktop and 40px on compact. Nothing in the nav row reaches 44px at either width.

### DEF-6 — minor — viewport breakpoints inside container-owned regions

`src/components/blocks/commerce/ProSubscriptionBlock/classNames.ts:38` (`sm:grid-cols-2`) and `:77-80`, `:100-101` (`sm:px-6`, `sm:pt-6`, `sm:pb-6`). These are Tailwind viewport queries applied to content whose available width is set by the `PrimaryRailLayout` container query, so a wide window with a narrow primary column resolves them wrongly.

### DEF-7 — minor — single-scheme illustration

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:213-221` serves one light-ground PNG to both schemes.

## Incidental observations, outside the audited scope

The authentication surface renders its card at the full 1216px container while the form itself occupies about 450px in the middle, leaving very large dead margins at 1280 in both schemes. Separately, `src/app/[lang]/` contains both a `subscriptions` directory and a `subcribtions` directory; the misspelt one looks like a leftover and is worth confirming before it accrues links.

## Reproduction

The dev server was started with `npm run dev` from the worktree and the process was killed at the end of the run; port 3000 is free again. Captures were taken with a headless Chrome script under `puppeteer-core`, one page per width and scheme, `prefers-color-scheme` emulated through CDP, `fullPage: true`, with the computed `grid-template-columns`, bounding rectangles, heading list, sticky positions, overflow set and control sizes read back from the same page.

## Round 2

- Date: 2026-09-03
- Role: `frontend.surface.audit`, re-run against the same worktree after `@starci/grammar` 0.4.6 was merged from `main`
- Repo / branch / head: `starci-academy-fe` / `session/20260903-starci-dashboard-subscriptions` / `be53d58` (merge commit `cc3f893`, `main` at `c449152`)
- Gates before the capture: `npx eslint --max-warnings=0 .` exit 0, `npx vitest run` exit 0 (498 files, 3015 passed, 35 skipped), `npx tsc --noEmit` exit 0, `sweep-presentation.mjs` clean over 40 files
- Runtime: Next.js 16.3.1 dev on port 3000, started for this run and stopped at the end; **Keycloak 8089 still down — no sign-in was attempted and no credential was typed**
- Capture engine: headless Chrome through `puppeteer-core`, a fresh browser context per capture, `prefers-color-scheme` emulated through CDP, `fullPage: true`
- Evidence: `r2-subscriptions-{1280,390}-{light,dark}.png`, `r2-authentication-390-light.png`, and the three measurement dumps `r2-measurements.json`, `r2-taste-probe.json`, `r2-taste-1280-light.json`, all in `.claude/tests/evidence/20260903-starci-dashboard-subscriptions/`

### What changed between the rounds

Three of the seven defects were Grammar's and were repaired in the package rather than in the application: `PrimaryRailLayout` now defaults to the collapsed form and moves every wide variant inside a `min-width` container query, so no attribute selector can outrank the collapse (DEF-1); both action slots of `NavigationFeatureNav` give their pressables a 44px `min-inline-size` and `min-block-size` (DEF-5, partly); and `.starci-core-surface-card` is zeroed to `padding: 0 !important`, removing the vendor `Card.Root` inset that held the benefits surface 16px in from its accordion peer (DEF-3). The application side supplied `collapsedOrder="rail-first"` (DEF-2), re-anchored the section headings so the outline no longer skips a level (DEF-4), converted the benefits grid and the plan card to `@app-sm:` container queries (DEF-6), and stopped serving the light-ground journey raster to dark readers (DEF-7). The `// GRAMMAR-GAP:` note that recorded DEF-3 was removed in this round, since 0.4.6 closes it at the source and nothing in the application was padding around it.

### Verdict table

| surface | width | scheme | finding | severity | rule | screenshot |
| --- | --- | --- | --- | --- | --- | --- |
| subscriptions | 390 | light | **DEF-1 fixed.** `starci-core-primary-rail-layout` computes `grid-template-columns: 358px` in a 358px container. The primary region is `x=16 w=358 h=806.38` and carries the illustration, all four outcomes and both disclosures | resolved | RESPONSIVE-1 Cases 1–2 | `r2-subscriptions-390-light.png` |
| subscriptions | 390 | light | **DEF-2 fixed.** `data-grammar-layout-collapsed-order="rail-first"`; the rail region computes `order: -1` and sits at `y=278`, the primary region at `y=563`. The price and the purchase button lead the collapsed flow | resolved | RESPONSIVE-1 Case 1 | `r2-subscriptions-390-light.png` |
| subscriptions | 1280 | light | **DEF-3 fixed.** `.starci-core-surface-card` computes `padding: 0px`; the benefits card and its accordion peer both measure `x=32 w=808`, and both inner surfaces also start at `x=32`. The 16px disagreement is gone at both edges | resolved | MARGIN / HIERARCHY-2 Case 4 | `r2-subscriptions-1280-light.png` |
| subscriptions | 1280 | light | **DEF-4 fixed.** The outline reads `H1 → H2 → H2 → H3 → H3 → H2`. No level is skipped; the two `H3` disclosure summaries sit under the `H2` that owns them, and the rail's `H2` is a sibling region, not a descendant | resolved | HIERARCHY-1 Case 1 | `r2-subscriptions-1280-light.png` |
| subscriptions | 1280 | light | **DEF-5 partly fixed.** The search trigger is `164.3 × 44` (`min-height: 44px`, `min-width: 44px`), and the language menu, cart and account are each `44 × 44`. **Still under the floor:** the three primary destinations `Trang chủ` / `Khóa học` / `Liên hệ` render `91.31 × 36`, `88.81 × 36` and `72.89 × 36`, and the theme switch is `64 × 36` | major | touch-target floor 44px | `r2-subscriptions-1280-light.png` |
| subscriptions | 390 | light | **DEF-5 fixed at this width.** The compact band collapses the destinations into one drawer trigger; every pressable in it — drawer, cart, account — measures `44 × 44`. No control in the band is under the floor | resolved | touch-target floor 44px | `r2-subscriptions-390-light.png` |
| subscriptions | 1280 | light | **DEF-6 fixed.** `classNames.ts:52,64,65` are `@app-sm:` container queries. The one surviving `sm:` is `proPageClassName` (`classNames.ts:13`), the route's own outer band above `PageContainer` and outside every container, which the file documents at `:6-9` | resolved | RESPONSIVE-2 Case 5 | `r2-subscriptions-1280-light.png` |
| subscriptions | 1280 | dark | **DEF-7 fixed as recorded.** No light-ground slab renders; the dark reader gets the benefits card without the illustration. The trade the fix accepts is visible: the dark page is 800px tall against light's 1104px, and the surface reads noticeably emptier | minor (open as `MISSING-ASSET`) | TONE | `r2-subscriptions-1280-dark.png` |
| subscriptions | 1280 | light | Sticky band holds: `header.starci-core-navigation-feature-nav` is `position: sticky; top: 0`, 79px tall | pass | LAYOUT-4 Case 1 | `r2-subscriptions-1280-light.png` |
| subscriptions | 1280 / 390 | light + dark | No inline overflow at either width or either scheme: `scrollWidth == clientWidth` (1280 and 390), and the offender sweep returns an empty set | pass | OVERFLOW | all four |
| subscriptions | 1280 | dark | Dark tokens still swap cleanly; DEF-1, DEF-3 and DEF-4 reproduce as fixed, and the DEF-5 remainder reproduces identically. The cause is scheme-independent in both directions | as above | as above | `r2-subscriptions-1280-dark.png` |
| authentication | 390 | light | **Band and `PressableField` not present on this route.** `/vi/authentication` mounts no `ShellNav`: the only `header` is the auth card's own 326×56 title block, and there is no `.starci-core-pressable-field` in the tree. The band's 44px targets and the field were therefore verified on `/vi/subscriptions` at 390 and 1280 instead, which mount the same shell | SURFACE_NOT_PRESENT | — | `r2-authentication-390-light.png` |
| authentication | 390 | light | Incidental, outside the audited scope: the auth form's own controls sit at 40px (`Đăng nhập với Google`, `Đăng nhập với GitHub`, both inputs and the submit are `326 × 40`), the reveal-password button is `16 × 16`, the remember checkbox `13 × 13`, and the two text actions `112 × 20` and `56.81 × 20` | major, unscoped | touch-target floor 44px | `r2-authentication-390-light.png` |
| subscriptions | — | — | Status band corner radius still unobservable — it renders only in `verification-pending`, `active` and `cancelled`, all of which need a signed-in read | RUNTIME_UNAVAILABLE | RADIUS-5 | — |

### Taste lens — `/vi/subscriptions`, 1280 × 800, light

Scored against `knowledge/ui/proof/taste.md` from `r2-subscriptions-1280-light.png` and the measurements in `r2-taste-1280-light.json`.

| criterion | score | pass | measurement |
| --- | --- | --- | --- |
| `TASTE-1` One focal point | 2 | **fail** (Case 3) | The journey illustration is `808 × 454.63 = 367,337px²`, against the `H1` at `768 × 30.7 = 23,580px²` and the purchase button at `352 × 44 = 15,488px²`. The artwork outweighs the `H1` 15× and the CTA 24×. Case 1 holds (only one candidate) and Case 2 holds (`H1` at `25.6px/700` against section titles at `16px/600`), but Case 3 fails: the surface's job is the purchase decision — which is why the direction passed `collapsedOrder="rail-first"` — and an artwork wins the frame |
| `TASTE-2` No meaningless void | 3 | **fail** (Case 1) | The rail column below the plan card is `384 × 616.3 = 236,659px²`, 16.7% of the `1280 × 1104` capture. It carries no content and performs no separation — the primary column simply runs past it. Case 2 holds (the tinted intro band carries a real sentence), Case 3 holds (the 2×2 outcome grid is fully filled), Case 4 holds (at 390 the void does not grow; the single column has no dead area) |
| `TASTE-3` Grid and edges | 5 | pass | Both peer cards measure `x=32 w=808` and the section headers start at `x=32`; the rail is `x=864 w=384`. Inside the benefits card, the intro copy is at `x=48` and the outcome cells at `x=80` and `x=484` — each a declared inset, consistent per region and per column. This is the DEF-3 repair reading correctly |
| `TASTE-4` Vertical rhythm | 5 | pass | Region gap 24px (`908.33 → 932.33`), section gap 12px (heading bottom `250.7` → card top `262.7`), row gap 0 with a divider between the two 52px disclosure rows. The order holds, the set of steps is closed (0 / 12 / 24 / 36), equal peers carry equal separation, and the same order survives at 390 |
| `TASTE-5` Colour economy | 5 | pass | Exactly one accent-filled control: `rgb(117, 71, 255)` on `Đăng nhập để mua StarCi Pro`. Every other filled control in the frame is neutral (`lab(93.02 …)` and `lab(99.99 …)`). The `Full access` chip is a single accent tint reporting the plan tier. Distinct backgrounds: four neutral greys, white, one accent and one accent tint. Case 3 is unobserved — no warning or error state renders in this capture |
| `TASTE-6` Type | 3 | **fail** (Cases 1, 2) | Case 1 fails in the rail region, which carries four distinct sizes and three weights: `36px/600`, `16px/600`, `14px/500`, `14px/400`, `12px/500`, `12px/400`. The benefits card (`14px/400`, `14px/600`, `12px/400`) and the accordion (`14px/600`, `14px/400`) are both within budget. Case 2 fails on the hero description: `max-w-3xl` gives it 768px at 14px, roughly 105 characters on one line, above the 80 ceiling. Cases 3 and 4 hold — no orphan lines, and the four outcome titles all render `14px/600` against four descriptions at `12px/400` |
| `TASTE-7` Shape consistency | 4 | pass | Radii resolve to one family plus a control role: 24px on both card roots and the CTA, 16px on both inner surfaces, 12px on the search field, pill on the nav text actions and icon buttons. Nesting is two levels deep at most (`surface-card` 24 → `surface` 16 → rows), peers carry equal elevation (both cards are `card--transparent`), and the CTA is inset 16px inside its 24px container so the corners do not collide. The seam costing it a point: the accordion root computes `0px` against the two card roots' `24px`, so the disclosures read as a flat list beside a carded peer |
| `TASTE-8` Imagery earns its place | 2 | **fail** (Cases 1, 4) | Case 4 fails on the same measurement as `TASTE-1`: at `367,337px²` the illustration is the heaviest thing in the frame and the surface's job is not the image. Case 1 fails on the dark capture's own evidence — removing the illustration is exactly what the DEF-7 fix does, and `r2-subscriptions-1280-dark.png` still reads as a complete surface, which is the rule's stated falsifier. Cases 2 and 3 hold: one decorative image, and it shares its card with the intro band and the outcome grid rather than justifying an empty one |
| `TASTE-9` Density | 3 | pass, with reservation | This is a purchase/marketing surface, so Case 2 governs. Rectangles counted for Case 3: band `1280 × 79 = 101,120`, section header `768 × 59.7 = 45,852`, primary region `808 × 845.63 = 683,265`, rail region `384 × 261 = 100,224`, summing to `930,461` of `1,413,120` — 65.8%. The reservation is Case 2's second clause: the breathing room is not continuous, because 16.7% of it is the single dead rail column measured under `TASTE-2`. Case 4 holds at 390 — density comes from ordering, and no target shrinks below 44px |
| `TASTE-10` Designed states | — | **void** | No loading, empty or error capture exists for this surface. The one state that would carry them — the plan status band — renders only in `verification-pending`, `active` and `cancelled`, and Keycloak is down, so no signed-in read is possible. Under `TASTE-13` Case 5 a score with no measurement is void, so none is recorded and the lens is incomplete |
| `TASTE-11` Touch and feedback | 2 | **fail** (Case 1) | Case 1 fails at 1280: three primary destinations at `91.31 × 36`, `88.81 × 36`, `72.89 × 36`, and the theme switch at `64 × 36`. It passes at 390, where every band control is `44 × 44`. Cases 2–4 are unobserved: no hover, focus or pending capture was taken |
| `TASTE-12` Reference match | 2 | **fail** (Case 1) | No direction decision for this surface names its reference standards by class. `tests/runs/20260903-frontend-refine-subscriptions.md` and its R2 are presentation-resolve records, not direction records, and neither names a reference. Case 1's own wording — "a direction naming none falsifies the audit before any capture is scored" — makes this a fail rather than an unobserved entry |

### Taste verdict — FIX FIRST

`TASTE-13` Case 2 requires no fail on `TASTE-1`, `TASTE-2`, `TASTE-5`, `TASTE-8` or `TASTE-12`, and a mean of at least 4. Three of the five gates fail (`TASTE-1`, `TASTE-2`, `TASTE-8`) and `TASTE-12` fails as well, so the verdict is `fix-first` on the gates alone. The mean over the eleven scored criteria is `3.27` (`2+3+5+5+5+3+4+2+3+2+2 = 36`, over 11), also below the threshold, and `TASTE-10` is void under Case 5, which leaves the lens formally incomplete regardless of arithmetic.

The three gate failures are one composition problem seen from three angles, and `TASTE-13` Case 4 routes it to direction rather than to resolve: a 455px-tall illustration is the loudest thing on a page whose job is a 229.000 ₫ decision, the plan card that carries that decision occupies 261px of a 1,104px rail column and leaves the remaining 616px dead, and the dark capture already proves the page survives without the artwork. No value swap repairs that; the region ranking has to be decided again.

### Overall verdict — FIX FIRST

Every canon defect the previous round could act on is closed. DEF-1, the blocker, is gone in both schemes: at 390 the primary column is a full 358px and the whole product explanation is visible on a phone, with the purchase decision correctly leading it. DEF-2, DEF-3, DEF-4 and DEF-6 are closed and measured. DEF-5 is closed everywhere it matters most — the entire compact band meets the 44px floor — and closed for the desktop action slots too. What is left of it is the desktop primary destinations and the theme switch, which Grammar 0.4.6 left deliberately out of scope. `TASTE-13` Case 3 is the reason the surface is still `fix-first` and not `ship`: canon being green does not buy a taste verdict, and the composition fails three of the five criteria a reader notices before reading a word.

### Remaining defects

#### DEF-5 (remainder) — major — desktop band controls under the 44px floor

`packages/grammar/src/common/styles.css:2363` (`.starci-core-text-action`, which sets no `min-block-size`) against the repaired action slots at `:1163-1164` and `:1333-1334`. The three primary destinations render `91.31 × 36`, `88.81 × 36` and `72.89 × 36` at 1280, and the HeroUI theme switch (`.switch--md`) renders `64 × 36`. Grammar 0.4.6's changelog scopes the fix to the two action slots and rules the feature layer's tabs out; the primary destination slot is neither, and it is the one still under the floor. The repair belongs in Grammar, on the pressable rather than the slot, exactly as the action slots were done. Consumed from the application at `src/components/product-shells/ShellNav/component.tsx`.

#### DEF-7 (open, unchanged) — minor — `MISSING-ASSET`, no dark illustration

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:229-250`. The fix is correct as a trade — a white slab on a dark ground is worse than no image — but the defect is the missing asset, not the branch. It closes when a dark variant of `/images/pro-subscription/pro-learning-journey-v1.png` ships. The comment at `:229-236` records this.

#### TASTE-1 / TASTE-8 — the artwork outranks the surface's job

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:238-250` renders the journey illustration at its full 808px column width, `454.63px` tall. It is 15× the `H1` and 24× the CTA by area. Routes to direction (`TASTE-13` Case 4): either the image is ranked below the decision it currently outshouts, or the surface admits the image is its job. A width or a height value chosen in presentation does not settle which region leads.

#### TASTE-2 / TASTE-9 — 616px of dead rail column

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:210-213` (`PrimaryRailLayout`, `railWidth="wide"`) against the plan card, which is 261px tall in a 1,104px page. The rail region ends at `y=487.7` and nothing occupies `384 × 616.3` below it. Routes to direction: either the rail earns a second region, or the wide layout is not what this surface's content asks for.

#### TASTE-6 Case 1 — four type sizes in the rail region

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx` rail branch, `:165-193`. `36px/600`, `16px/600`, `14px/500`, `14px/400`, `12px/500` and `12px/400` all render inside one region, against the rule's ceiling of three sizes and two weights.

#### TASTE-6 Case 2 — hero measure runs past 80 characters

`src/components/blocks/commerce/ProSubscriptionBlock/classNames.ts:16` (`proHeroClassName`, `max-w-3xl`). 768px at `14px` is roughly 105 characters per line at 1280, above the 45–80 band the rule names. This one is an app-owned boundary and does route to presentation.

#### TASTE-12 — no direction record naming references

No direction decision for `/vi/subscriptions` names the reference standards it aims at by class. Until one exists, `TASTE-12` Case 1 falsifies the lens by its own wording, and no capture of this surface can score it.

### Reproduction

The dev server was started with `npm run dev` from the worktree (port 3000 was free) and its process tree was killed at the end of the run; port 3000 holds only `TIME_WAIT` sockets and no listener. Captures were taken with headless Chrome under `puppeteer-core`, one fresh browser context per width and scheme, `prefers-color-scheme` emulated through CDP, `fullPage: true`, with grid tracks, computed order, bounding rectangles, the heading list, control sizes, font-size and radius censuses, and the overflow set read back from the same page. The three JSON dumps beside the PNGs carry every number quoted above.
