# cart

Migrated from the previous shape mid-run. Plan, Preview and Apply ran against the record-and-seal
skills; their evidence lives in `starci-academy-fe/.artifacts/design-plan/cart/`
(`plan-record.md`, `installment-analysis.md`, `design-record.md/json`, `screens/`, `candidate/`).
This file is that evidence in the shape `starci-workflow-drift` reads.

## plan

SCOPE
| | |
|---|---|
| Doing | The cart: a `/cart` page, a cart drawer, and where the instalment offer lives |
| Repo / branch | `starci-academy-fe` @ `main` (`8410a74` at Plan time) |
| Touching | artifacts only |
| Not touching | all production source |
| Produces | four directions at `localhost:8096` |

CHOSE   `direction-legacy-full-default` — the reference's own position, kept. The payment step opens
        on paying at once; instalments are a choice the buyer turns on. Chosen one turn after asking
        for A and B to be inverted to an instalment default and being shown what that default costs.
TOOK    Instalments already ship on the backend end to end. One term only: 3 months. The frontend
        renders none of it.
TOOK    Markup drops 10% → **5%**, by the teacher. Shares must sum to `100 + markup`, so the first
        instruction 50/30/30 (= 110) no longer closes; keeping the instructed 50% first cycle leaves
        55 to split, giving **50 / 27,5 / 27,5**. On the worked cart: 2.475.000 + 1.361.250 ×2 =
        5.197.500. Working in `installment-analysis.md`.
TOOK    Nothing client-side recomputes a discount or a cycle. The legacy drawer re-declared the
        bundle tiers as constants; that is the copy nobody edits when the server's changes.
TOOK    A fourth direction was kept in the lab holding the reference default, because the other
        three departed from it and a departure nobody can see beside what it left is asserted rather
        than reviewed.

## review

SCOPE
| | |
|---|---|
| Doing | Build the cart from the real components, contracts, shells and tokens |
| Repo / branch | `starci-academy-fe` @ `main` (`f06071e`) |
| Touching | `.artifacts/design-plan/cart/candidate/` |
| Not touching | all production source |
| Produces | twelve rendered states at `localhost:8087` |

STATES  CartPage → populated → rendered (`screens/cart-populated.png`)
        CartPage → one item → rendered
        CartPage → empty → rendered
        CartPage → pricing pending → rendered (rows real, figures resting)
        CartPage → pricing failed → rendered (rows stand, totals become an em dash, hint withheld)
        CartPage → removing one line → rendered (the other rows stay pressable)
        CartPage → narrow → **measured, not photographed**. At 375px the browser reports
        `scrollWidth === clientWidth === 375`, zero overflowing nodes, cover `display:none`,
        identity 102px / price 129px / removal 40px. Headless Chrome lays out wider than its window
        and crops, in both the old and the new headless, so that PNG is not evidence.
        CartPage → light theme → rendered at desktop width; the token inversion was not read node by
        node
        CartPage → clear-all ARMED → **not rendered, and the state was removed rather than faked**.
        Arming is client state behind a real pointer press; react-aria `onPress` ignores a synthetic
        click and the browser pane was hidden, so a static export drew the resting control while the
        state claimed the armed one.
        CartDrawer → open populated → rendered
        CartDrawer → open empty → rendered
        CartDrawer → dismissal and focus return → not rendered; delegated entirely to the vendor
        `Drawer`, and no state exercised the keyboard
        CheckoutOverlay → paying at once → rendered (the default: no surcharge, no ladder, all five
        gateways)
        CheckoutOverlay → paying over time → rendered (surcharge line, three cycles with one marked,
        terms, gateways narrowed to the domestic pair)
        CheckoutOverlay → submitting → not rendered; the press hands off to a provider this
        candidate does not have

BACKEND two enablers, both bounded, neither built:
        `installment-weighted-schedule` — markup to 5 and a BASIS-POINT share vector
        `5000,2750,2750` snapshotted per plan in a `cycle_bps` column beside the existing
        `markup_percent`, with `computeMinPaymentVnd(Fixed)` reading `cycles[installmentsPaid]`.
        Basis points because 27,5 is not an integer and the surrounding columns are `int`. Live
        plans with no vector keep the even split they were sold under.
        `installment-preview-schedule` — `cycles[]` on `InstallmentOptionItem`, month offsets rather
        than dates, because the server holds one rolling `nextDueAt` and no calendar.
        → `$starci-be-feature-plan` owns both.

APPROVED revision 1.0, confirmed after the revision was named back. Three traits were rejected on
        the way:
        `DrawerShell` on `Modal` with `placement="right"` — refused once HeroUI 3.2.4 turned out to
            ship a real `Drawer` with its own placement, header, handle and edge transitions. The
            inventory had said "no drawer in `src/`", which is true and was misread as "no drawer".
        A new `installment-cycle-row` — refused as a duplicate of `pricing-phase-row`'s classes,
            three slots and mark mechanic. Merged instead by freeing that pair of its domain name:
            `pricing-phase-*` → `ordered-step-*`.
        A `cart-clear-armed` state — removed rather than shipped showing the wrong control.

TOOK    Line removal is a glyph, not words: the only destructive thing on the row, and its name
        repeated down a list gives the loudest reading to the action nobody came for.
TOOK    Clear-all asks first, and that was READ rather than chosen — the legacy cart arms an inline
        two-step confirm for a few seconds instead of opening a modal, commented "canon: destructive
        action needs confirmation". Ported as the leaf `ConfirmButton`. The drawer does not get the
        control at all.
TOOK    The instalment hint names the FIRST payment, not a per-month figure: under a front-loaded
        schedule the opening cycle is the most expensive, so a from-price would be a false floor.
TOOK    The hint is withheld while pricing is pending or failed, because it quotes a number the
        summary beside it cannot show.
TOOK    `order-total-row` is its own entry rather than `label-with-muted-fact-row`, because rank is
        the whole difference: that entry pins its fact to `xs`/`muted`, the opposite rank to a total.
TOOK    `OrderSummary` does not reuse `stacked-stat-rows` — it holds `stat-row`, which requires an
        `icon`, and a subtotal has no honest glyph.

## apply

SCOPE
| | |
|---|---|
| Doing | Write revision 1.0 into production |
| Repo / branch | `starci-academy-fe` @ `main` (`f06071e`) |
| Touching | the nine files below |
| Not touching | every other path under `src`; `starci-academy` |
| Produces | the components; **no route** — see OWED |

WROTE   src/components/shells/DrawerShell/index.tsx                       (new; wraps HeroUI `Drawer`)
        src/components/leaves/ConfirmButton/index.tsx                     (new)
        src/components/blocks/commerce/CartLine/component.tsx             (new)
        src/components/blocks/commerce/OrderSummary/component.tsx         (new)
        src/components/overlays/commerce/CartDrawer/component.tsx         (new)
        src/components/overlays/commerce/CheckoutOverlay/component.tsx    (new)
        src/components/pages/CartPage/component.tsx                       (new)
        src/components/contracts/index.ts                                 (seven entries, six union
                                                                           members, two renames, and
                                                                           `confirm-button` admitted
                                                                           to `stacked-peer-controls`)
        src/components/blocks/courses/CoursePricingRail/component.tsx     (migrated to
                                                                           `ordered-step-*`; sole
                                                                           caller of the rename)

        The registry was MERGED rather than replaced: another session added 163 lines to it while
        this run was building, and the candidate's copy was taken before that.

GREEN   npx tsc --noEmit                  clean, whole repository
        npx eslint src                    exit 0
        npx next build --webpack          exit 0
        audit-fe-lint-adoption.mjs        ok; no rule missing, none below error, inline config refused

OWED    **Nothing mounts any of this.** There is no `/[lang]/cart` route and no connected half:
        every owner written is the pure twin. `myCart` ships on the backend and has no frontend
        query, no hook and no caller. Until that exists the cart cannot be opened, which is why this
        Apply produced components rather than a page.
OWED    The navbar cart button is still dead — `ShellNav/component.tsx:103` renders
        `IconButton icon="cart"` with no `on` handler at all. One line, once there is a drawer to
        open.
OWED    Both backend enablers above. Without them the schedule is a picture: the server still
        charges three equal cycles at 10%.
OWED    `ConfirmButton`'s armed state has never been observed by anyone.
OWED    The drawer's focus return and keyboard path.
