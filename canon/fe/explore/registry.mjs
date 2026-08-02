/**
 * patterns — every named layout decision in the system, and the value it must compute to.
 *
 * TWO LAYERS (grounded in a full-tree deep scan + Every Layout, thầy 2026-08-01):
 *
 *   STRUCTURE is carried by FRAMES, not by tokens here. Display, direction, wrap, grid, responsive,
 *   position, overflow and sizing are what a component you USE decides — `Stack`, `Cluster`, `Split`,
 *   `Grid`, `Container`, `RailShell`, `SplitWorkspace`, `ResponsiveRow`, `Reel`, `Cover`. Those
 *   frames already exist (and the scan found the app barely adopts them — that is the migration).
 *   A frame emits its OWN structural token (like `data-component`); the caller does not set it.
 *
 *   SPACING is carried by the tokens below, PASSED BY THE CALLER (like `anatPart`), because only the
 *   caller knows WHY a gap is what it is. This is the layer neither Every Layout nor Braid names.
 *
 * A component declares every pattern it embodies, space-separated like `class`:
 *
 *     <div data-principles="card-padding block-boundary" className="flex flex-col gap-6 p-4"> … </div>
 *
 * Queryable `[data-principles~="card-padding"]`, split on whitespace by the test. Each entry says which
 * CSS property it governs and the value it must compute to; the test in `test-runner.ts` measures it.
 *
 * The token is the CONCEPT, never the pixel — `data-principles="card-padding"`, never `"p-4"`.
 *
 * gap step → px: 1→0 2→4 3→8 4→12 5→16 6→24 7→32 8→48   (principles/gap.md)
 * padding step → px: 1→0 2→4 3→8 4→12 5→16 6→24          (principles/padding.md)
 */

export const PATTERNS = {
    // ── gap · step 1 (0px) · one thing, no seam ───────────────────────────────────────────
    "name-handle": { prop: "gap", step: 1, px: 0, what: "a name stacked directly over its handle/role — the two lines of an identity, no seam between them (inside `identity`)" },

    // ── gap · step 2 (4px) · a JOINT inside one thing ─────────────────────────────────────
    "icon-text": { prop: "gap", step: 2, px: 4, what: "an icon and the text it belongs to — a glyph hugging its word, clickable or not (covers back-link, breadcrumb, see-more, a button's icon+label)" },
    "separator-dot": { prop: "gap", step: 2, px: 4, what: "a · separating meta fragments — 12 lessons · 3 hours · Free" },
    "title-subtitle": { prop: "gap", step: 2, px: 4, what: "a title and its subtitle CONTINUING it in one voice — a card title over its description (measured 4px across ~130 sites, not 8)" },

    // ── gap · step 3 (8px) · the WITHIN-A-UNIT seam ───────────────────────────────────────
    "flex-action": { prop: "gap", step: 3, px: 8, what: "a row of controls a person acts on — buttons side by side, an input and its button" },
    "identity": { prop: "gap", step: 3, px: 8, what: "an avatar and the name/handle beside it — a person's identity as one unit (the inner name↔handle seam is `name-handle`, 0px)" },
    "value-row": { prop: "gap", step: 3, px: 8, what: "numbers read together on one baseline — a price, its struck original, its period. ALWAYS items-baseline (the cleanest signal in the app, 0 outliers)" },
    "chip-row": { prop: "gap", step: 3, px: 8, what: "a wrapping row of same-kind chips/tags — filters, keywords (display, not controls-you-act-on)" },
    "sibling-stack": { prop: "gap", step: 3, px: 8, what: "a column of peers, none subordinate — accordion panels, a list of options" },

    // ── gap · step 4 (12px) · a LABEL, or a row's segments ────────────────────────────────
    "label-field": { prop: "gap", step: 4, px: 12, what: "a label and the control it NAMES — a boundary, a change of register" },
    "content-row": { prop: "gap", step: 4, px: 12, what: "a list row's segments — a leading icon, a title/meta block, a trailing action. The most recurring row shape in the app" },
    "card-caption": { prop: "gap", step: 4, px: 12, what: "a card and its description/caption sitting outside it" },

    // ── gap · step 5 (16px) · between GROUPS in one surface ───────────────────────────────
    "group-boundary": { prop: "gap", step: 5, px: 16, what: "two groups in one surface — two field clusters, a card's header block and its body. (This is what the 52 `gap-4` sites the SSOT called 'unclustered' actually are.)" },

    // ── gap · step 6 (24px) · between BLOCKS in a page ────────────────────────────────────
    "block-boundary": { prop: "gap", step: 6, px: 24, what: "two blocks in a page — one card and the next, section↔section. The single most common block seam (271 sites)" },

    // ── gap · step 7 (32px) · the LAYOUT seam ─────────────────────────────────────────────
    "layout-split": { prop: "gap", step: 7, px: 32, what: "the layout seam — two columns left/right, a header and the content under it (was gap-10/40px; 56 sites pending migration to 32)" },

    // ── gap · marketing tier — a THIRD scale, landing pages only ──────────────────────────
    "marketing-beat": { prop: "gap", step: 8, px: 48, what: "full-width bands on a page that SELLS not teaches — landing only, its own rhythm (48px+, above the app's 8-rung scale)" },

    // ── padding · SYMMETRIC (a surface's own inset) ───────────────────────────────────────
    "cell-pad": { prop: "padding", step: 4, px: 12, what: "a dense inner surface — a list-row cell, a compact tile (p-3, the app's most common card interior)" },
    "card-padding": { prop: "padding", step: 5, px: 16, what: "card, modal, drawer — the house padding for a surface that holds groups (p-4). Set globally on `.card`/`.modal__dialog`" },
    "page-pad": { prop: "padding", step: 6, px: 24, what: "the outermost page/section measure before the viewport (p-6, the documented 'web measure')" },

    // ── padding · ASYMMETRIC (px ≠ py — the dominant real shape, 247 sites) ────────────────
    "control-pad": { prop: "padding-xy", x: 12, y: 8, what: "px-3 py-2 — a pill, badge, dropdown item, input row: a control holding short text (71 sites, the largest padding cluster)" },
    "row-pad": { prop: "padding-xy", x: 16, y: 12, what: "px-4 py-3 — a bordered/rounded row holding a full line: list row, card section shell (42 sites)" },
    "pill-pad": { prop: "padding-xy", x: 16, y: 8, what: "px-4 py-2 — a punchy pill button, a chip with weight, a CTA (35 sites)" },

    // ── alignment (position within the parent) ────────────────────────────────────────────
    "push-end": { prop: "margin", side: "left", value: "auto", what: "push one child to the trailing end of a flex row (ml-auto) — a timestamp, badge or CTA shoved to the end. 144 sites use this illegally today" },
    "pin-bottom": { prop: "margin", side: "top", value: "auto", what: "pin a card footer to the bottom of a flex-col regardless of content height (mt-auto)" },
    "center-measure": { prop: "margin", side: "x", value: "auto", what: "centre a content measure in its parent (mx-auto) — the reading column. This is what `Container` owns; ~110 sites still hand-roll it" },

    // ── STRUCTURAL tokens — emitted BY THE FRAME, not passed by a caller (phase 2) ─────────
    // A frame declares its own structural token the way it declares data-component. The test
    // measures the property the token governs. These land as the frames are built/adopted; the
    // registry names them now so a frame emitting one is checkable the day it does.
    "reel": { prop: "overflow", axis: "x", value: "auto", what: "a horizontally scrolling row — a chip reel, a tab strip. The house standard is HeroUI `ScrollShadow`; the `Reel` frame is the one still missing" },
    "sticky-top": { prop: "position", value: "sticky", what: "a header/sub-header pinned to the top of its scroll region" },
    "fixed-bar": { prop: "position", value: "fixed", what: "a bottom action bar or FAB pinned to the viewport, rail-aware (right offset by --app-rail-w)" },
    "stack-below": { prop: "breakpoint", what: "a row that becomes a full-width column below a named container width (the Switcher — `ResponsiveRow`/`ResponsiveCluster`)" },
}

/** Which computed property each `prop` reads, and how. */
export const PROP_READS = {
    gap: ["rowGap", "columnGap"],
    padding: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
    "padding-xy": { x: ["paddingLeft", "paddingRight"], y: ["paddingTop", "paddingBottom"] },
    margin: { left: "marginLeft", top: "marginTop", x: ["marginLeft", "marginRight"] },
    overflow: { x: "overflowX", y: "overflowY" },
    position: "position",
    breakpoint: null, // asserted by the responsive-switch sweep, not a single computed value
}
